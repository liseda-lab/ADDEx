import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as nnf

import warnings
warnings.filterwarnings("ignore", category=DeprecationWarning)

import os
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'

class Agent(nn.Module):

    def __init__(self, params):
        super().__init__()
        if torch.cuda.is_available():
            self.device = torch.device("cuda")
        elif torch.backends.mps.is_available():
            self.device = torch.device("mps")
        else:
            self.device = torch.device("cpu")
        
        self.prevent_cycles =params['prevent_cycles']
        self.guiding_ic=params['agent_IC_guiding']
        self.IC_reward=params['IC_reward']
        self.adjust_factor=params['IC_importance']
        self.action_vocab_size = len(params['relation_vocab'])
        self.entity_vocab_size = len(params['entity_vocab'])
        self.embedding_size = params['embedding_size']
        self.hidden_size = params['hidden_size']
        self.ePAD = int(params['entity_vocab']['PAD'])
        self.rPAD = int(params['relation_vocab']['PAD'])
        self.train_entities = params['train_entity_embeddings']
        self.train_relations = params['train_relation_embeddings']

        self.num_rollouts = params['num_rollouts']
        self.test_rollouts = params['test_rollouts']
        self.LSTM_Layers = params['LSTM_layers']
        self.batch_size = params['batch_size'] * params['num_rollouts']
        self.dummy_start_label = torch.full((self.batch_size,), fill_value=params['relation_vocab']['DUMMY_START_RELATION'], dtype=torch.long, device=self.device)

        self.entity_embedding_size = self.embedding_size
        self.use_entity_embeddings = params['use_entity_embeddings']
        self.m = 4 if self.use_entity_embeddings else 2

        self.relation_lookup_table = nn.Embedding(self.action_vocab_size, 2 * self.embedding_size)
        self.entity_lookup_table = nn.Embedding(self.entity_vocab_size, 2 * self.entity_embedding_size)

        nn.init.xavier_uniform_(self.relation_lookup_table.weight)
        if self.use_entity_embeddings:
            nn.init.xavier_uniform_(self.entity_lookup_table.weight)
        else:
            nn.init.zeros_(self.entity_lookup_table.weight)

        self.relation_lookup_table.weight.requires_grad = self.train_relations
        self.entity_lookup_table.weight.requires_grad = self.train_entities

        self.policy_step = nn.LSTM(self.m * self.embedding_size, self.m * self.hidden_size, self.LSTM_Layers, batch_first=True)

        mlp_input_dim = (self.m * self.hidden_size) + (2 * self.embedding_size)
        if self.use_entity_embeddings:
            mlp_input_dim += 2 * self.entity_embedding_size

        mlp_hidden_dim = 4 * self.hidden_size
        mlp_output_dim = self.m * self.embedding_size

        self.fc1 = nn.Linear(mlp_input_dim, mlp_hidden_dim)
        self.fc2 = nn.Linear(mlp_hidden_dim, mlp_output_dim)

        self.to(self.device)


    def get_mem_shape(self):
        return (self.LSTM_Layers, 2, None, self.m * self.hidden_size)

    def zero_state(self, batch_size):
        """
        Return zero LSTM state (h0, c0) shaped for PyTorch LSTM: (num_layers, batch, hidden_size)
        """
        h0 = torch.zeros(self.LSTM_Layers, batch_size, self.m * self.hidden_size, device=self.device)
        c0 = torch.zeros(self.LSTM_Layers, batch_size, self.m * self.hidden_size, device=self.device)
        return (h0, c0)

    def policy_MLP(self, state):
        hidden = nnf.relu(self.fc1(state))
        output = nnf.relu(self.fc2(hidden))
        return output

    def action_encoder(self, next_relations, next_entities):
        relation_embedding = self.relation_lookup_table(next_relations)
        if self.use_entity_embeddings:
            entity_embedding = self.entity_lookup_table(next_entities)
            action_embedding = torch.cat([relation_embedding, entity_embedding], dim=-1)
        else:
            action_embedding = relation_embedding  # shape [B, A, 2*embedding_size]
        return action_embedding

    def step(self, next_relations, next_entities, next_weights, prev_state, prev_relation, query_embedding, current_entities,
             label_action, range_arr, first_step_of_test):
        """
        Executes one step of the policy, updating state and scoring actions.

        Args:
            next_relations: Candidate relations for the next step [B, MAX_NUM_ACTIONS].
            next_entities: Candidate entities for the next step [B, MAX_NUM_ACTIONS].
            next_weights: Edge weights corresponding to candidate actions [B, MAX_NUM_ACTIONS].
            prev_state: Previous LSTM state.
            prev_relation: Previous relation taken by the agent.
            query_embedding: Embedding of the query relation [B, 2D].
            current_entities: Current entities [B].
            label_action: Ground truth action for supervised training [B].
            range_arr: Range array to map indices.
            first_step_of_test: Flag indicating if it's the first step during testing.

        Returns:
            loss: Sparse softmax cross-entropy loss for the selected action.
            new_state: Updated LSTM state after the step.
            logits: Logits (non-normalized scores) for the candidate actions [B, MAX_NUM_ACTIONS].
            action_idx: Index of the chosen action.
            chosen_relation: Relation corresponding to the chosen action.
        """

        prev_action_embedding = self.action_encoder(prev_relation, current_entities)

        output, new_state = self.policy_step(prev_action_embedding.unsqueeze(1), prev_state)  # output: [B, 1, hidden_size]
        output = output.squeeze(1)  # output: [B, hidden_size]

        prev_entity = self.entity_lookup_table(current_entities)
        if self.use_entity_embeddings:
            state = torch.cat([output, prev_entity], dim=-1)
        else:
            state = output

        candidate_action_embeddings = self.action_encoder(next_relations, next_entities)
        state_query_concat = torch.cat([state, query_embedding], dim=-1)

        output = self.policy_MLP(state_query_concat)
        output_expanded = output.unsqueeze(1)

        # Logits = dot product between the agent state and each candidate action embedding
        prelim_scores = torch.sum(candidate_action_embeddings * output_expanded, dim=2)

        # Apply edge weights to prioritize high-IC actions
        if self.guiding_ic:
            prelim_scores = prelim_scores * next_weights

        # Mask PAD actions with a very low score so they're never selected
        mask = (next_relations == self.rPAD)
        dummy_scores = torch.ones_like(prelim_scores) * -99999.0
        scores = torch.where(mask, dummy_scores, prelim_scores)

        # multinomial requires probabilities, so apply softmax first
        smax_scores = nnf.softmax(scores, dim=-1)
        action = torch.multinomial(smax_scores, num_samples=1)  # [B, 1]

        label_action = torch.squeeze(action, axis=1)
        loss = nnf.cross_entropy(scores, label_action, reduction='none')

        action_idx = torch.squeeze(action)
        chosen_relation = next_relations[range_arr, action_idx]

        return loss, new_state, nnf.log_softmax(scores, dim=-1), action_idx, chosen_relation


    def forward(self, candidate_relation_sequence, candidate_entity_sequence, current_entities,
         next_weights_sequence, path_label, query_relation, range_arr,
         first_step_of_test, prev_relation, prev_state, entity_sequence = 0):

        self.baseline_inputs = []

        # query_relation is already on device from the trainer
        query_embedding = self.relation_lookup_table(query_relation)  # [B, 2D]

        if prev_state is None:
            state = self.zero_state(self.batch_size)
        else:
            state = prev_state

        loss, new_state, logits, action_idx, chosen_relation = self.step(
            candidate_relation_sequence,
            candidate_entity_sequence,
            next_weights_sequence,
            state,
            prev_relation,
            query_embedding,
            current_entities,
            label_action=path_label,
            range_arr=range_arr,
            first_step_of_test=first_step_of_test,
        )

        return loss, new_state, logits, action_idx, chosen_relation
