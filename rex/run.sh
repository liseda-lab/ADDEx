#!/usr/bin/env bash
config_path="$1"
job_id="$2"

if [ -z "$config_path" ]; then
    echo "Usage: bash run.sh configs/{dataset}/{task}/{persona}.sh [job_id]"
    exit 1
fi

if [ ! -f "$config_path" ]; then
    echo "Config file not found: $config_path"

    if [[ "$config_path" == *.txt ]]; then
        candidate="${config_path%.txt}.sh"
        if [ -f "$candidate" ]; then
            echo "Did you mean: $candidate ?"
        fi
    fi

    exit 1
fi

. "$config_path"
export PYTHONPATH="."
gpu_id=0

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
app_root="$(dirname "$script_dir")"

resolve_repo_path() {
    local configured_path="$1"

    if [ -z "$configured_path" ]; then
        printf '%s' "$configured_path"
        return
    fi

    # 1) as-is relative to current cwd
    if [ -e "$configured_path" ]; then
        printf '%s' "$configured_path"
        return
    fi

    # 2) relative to app root (parent of rex/)
    local from_app_root="$app_root/$configured_path"
    if [ -e "$from_app_root" ]; then
        printf '%s' "$from_app_root"
        return
    fi

    # 3) relative to the rex/ directory itself — handles configs that use a
    #    "rex/..." prefix and cases where cwd happens to be rex/ already
    local stripped="${configured_path#rex/}"
    local from_rex_root="$script_dir/$stripped"
    if [ -e "$from_rex_root" ]; then
        printf '%s' "$from_rex_root"
        return
    fi

    # 4) give up — return original so Python reports a clean FileNotFoundError
    printf '%s' "$configured_path"
}

data_input_dir="$(resolve_repo_path "$data_input_dir")"
vocab_dir="$(resolve_repo_path "$vocab_dir")"
model_load_dir="$(resolve_repo_path "$model_load_dir")"

cmd=(python -u code/model/trainer.py
    --base_output_dir "$base_output_dir"
    --path_length "$path_length"
    --hidden_size "$hidden_size" --embedding_size "$embedding_size"
    --batch_size "$batch_size" --beta "$beta" --Lambda "$Lambda"
    --use_entity_embeddings "$use_entity_embeddings"
    --train_entity_embeddings "$train_entity_embeddings"
    --train_relation_embeddings "$train_relation_embeddings"
    --learning_rate "$learning_rate" --num_rollouts "$num_rollouts"
    --LSTM_layers "$LSTM_layers" --eval_every "$eval_every"
    --max_num_actions "$max_num_actions" --data_input_dir "$data_input_dir"
    --vocab_dir "$vocab_dir" --model_load_dir "$model_load_dir"
    --load_model "$load_model" --total_iterations "$total_iterations"
    --IC_reward "${IC_reward:-1}" --early_stopping "$early_stopping"
    --agentic_ai_enabled "$agentic_ai_enabled" --persona_path "$persona_path"
    --viz_mode "${viz_mode:-0}"
    --skip_lca "${skip_lca:-0}"
)

if [ -n "$job_id" ]; then
    cmd+=(--job_id "$job_id")
fi

echo "Executing ${cmd[*]}"
echo "[run.sh] Launching Python at $(date '+%H:%M:%S')"

CUDA_VISIBLE_DEVICES=$gpu_id "${cmd[@]}"
exit_code=$?
echo "[run.sh] Python exited with code $exit_code at $(date '+%H:%M:%S')"
exit $exit_code
