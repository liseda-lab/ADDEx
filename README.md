# ADDEx — Adaptive Drug Development Explanations

**Expert-Centered Explainable AI for Drug Development.**
Hypotheses you can explore, evaluate, and trust.

ADDEx is an interactive web system for generating, exploring, and assessing
mechanistic explanations of drug-development hypotheses over biomedical
knowledge graphs. It supports both **drug repurposing** and
**drug–target interaction** tasks, adapts the explanation style to the user,
and pairs every prediction with a reasoning path through the graph plus a
natural-language summary the expert can scrutinize.

> Hosted instance: *coming soon* — no installation required for end users.

---

## Why ADDEx

Computational hypothesis generation in drug development is dominated by models
that optimize for predictive accuracy without producing the mechanistic
transparency that domain experts need to decide *why* a drug might work for a
new indication. Existing knowledge-graph explanation methods are typically
**model-centric and one-shot**: a fixed set of paths, identical for every user,
with no way to ask for an alternative perspective or follow the evidence into
the broader biomedical record.

ADDEx is built around three observations:

1. **Mechanistic transparency matters more than raw accuracy.** Reasoning paths
   through a knowledge graph give experts an auditable chain of evidence, not
   just a feature-importance score.
2. **Different experts reason differently.** A pharmacologist and a molecular
   biologist evaluate the same hypothesis through different lenses, so the
   explanation needs to adapt.
3. **Hypothesis evaluation is iterative.** Experts compare alternatives,
   surface additional candidates, and consult external sources — a static
   one-shot output does not match how they work.

ADDEx integrates the full loop from hypothesis → adaptive explanation →
interactive exploration, in a single tool.

---

## Features

- **Three explanation modes (personas)** that condition path selection and the
  natural-language summary:
  - *Mechanistic Analyst* — detailed step-by-step reasoning over specific
    relations.
  - *Insight-Driven Synthesist* — concise, pivotal connections with high-level
    ontological context.
  - *Neutral Evaluator* — uniform baseline without persona conditioning.
- **Three biomedical knowledge graphs**: Hetionet, PrimeKG, OREGANO.
- **Two tasks**: drug repurposing and drug–target interaction.
- **Adaptive path selection** powered by the REx reinforcement-learning agent,
  with paths enriched by ontological lowest-common-ancestor (LCA) nodes drawn
  from NCIT, ChEBI, and the Gene Ontology.
- **LLM verbalization** of the top-ranked paths into a coherent natural-language
  explanation, regeneratable on demand to reflect the currently visible paths.
- **Interactive graph visualization** built with Cytoscape.js and the ELK
  layout engine: path-by-path exploration, path-aware highlighting, score
  inspection (IC + agentic score), drag-based layout, deep links into
  authoritative external sources (DrugBank, NCBI Gene, Disease Ontology,
  UniProt, MONDO, Orphanet, ChEMBL, PharmGKB, HMDB, NPASS, …), and one-click
  export to SVG / PNG / JPEG / PDF with optional caption and verbalization.
- **Onboarding aids**: a Guide page that walks through the workflow and the
  visualization, plus curated example pairs that pre-populate persona, dataset,
  task, and source–target so a new user reaches a working explanation in one
  click.
- **Accessibility**: five themes including a high-contrast WCAG-AAA mode based
  on the Okabe–Ito color-blind-safe scheme, an Okabe–Ito graph-palette override
  inside the visualizer, and full `prefers-reduced-motion` support.

---

## Quick start (end users)

The fastest way to use ADDEx is the hosted instance — open it in any modern
browser, no installation needed:

```
https://XXX-ADDEx.app   # final URL — coming soon
```

From the homepage:

1. **Start Exploring** opens the explanation-mode setup. Either answer a short
   profiling questionnaire or pick a mode manually. *Returning users* can skip
   straight to the search panel via *Quick Search*.
2. Choose a knowledge graph (Hetionet, PrimeKG, OREGANO) and a task
   (drug repurposing or drug–target interaction).
3. Pick a source–target pair from the synchronized selectors, or click one of
   the curated **examples** to run an immediately-working search.
4. Inspect the resulting graph, read the verbal summary, follow the entity
   links into external resources, toggle additional paths, regenerate the
   summary on demand, and export the result.

A persistent **Guide** is reachable from the navigation bar on every page.

---

## Local development

ADDEx ships as a single repository that bundles both the Next.js web
application and the **REx** reinforcement-learning engine (under `rex/`),
including its code, configs, and pre-trained model checkpoints. There is
nothing external to wire up — clone, install, run.

A standalone version of the REx implementation (without the ADDEx UI) is
maintained separately
[here](https://github.com/liseda-lab/REx_PyTorch) for users
who want only the engine.

For end-user use of the hosted instance, you do **not** need to clone or run
this repository at all. The instructions below are for developers who want to
run ADDEx locally, contribute, or retrain the models.

### Prerequisites

- **Node.js 18.18+** (or 20+) and **npm** (or pnpm / yarn / bun) for the web
  app.
- **Python 3.11+** and [`uv`](https://docs.astral.sh/uv/) for the bundled
  REx engine and verbalizer (dependencies are declared in
  `rex/pyproject.toml`; `uv` resolves them on first run).
- A modern web browser.
- For *retraining* models — not required for inference or to run the UI —
  a CUDA-compatible GPU.

Inference is supported on CUDA GPUs, Apple MPS, and CPU; the execution device
is auto-detected at startup.

### Run the web app

```bash
npm install                 # frontend deps
cd rex && uv sync && cd ..  # (recommended) pre-install Python deps
npm run dev
```

Open http://localhost:3000.

The `uv sync` step is technically optional — `uv run` auto-syncs on first
invocation, so the very first REx or verbalization request would do the
install on demand. Running `uv sync` upfront just shifts that 2-5 minute
install cost out of the user-visible "first request" path.

The dev server uses Turbopack and supports hot reload. To produce a production
build:

```bash
npm run build
npm run start
```

### Verbalization model (auto-downloaded on first use)

Verbalization runs on a quantized 1.7B Qwen model via `llama.cpp`. The model
file (~1 GB) is downloaded automatically from HuggingFace into
`rex/models/Qwen3-1.7B-Q4_K_M.gguf` the first time a verbalization is
requested. No manual setup needed; subsequent runs use the cached file.

If the download fails (no network, HF unreachable) or the `llama-cpp-python`
package isn't installed, ADDEx falls back to the original transformers
backend automatically. To disable the GGUF backend explicitly, set
`USE_GGUF = False` at the top of `rex/code/tools/generate_global_explanation.py`.

### Optional: hardware-accelerated builds for verbalization

The default `uv sync` installs the CPU-optimized `llama-cpp-python` wheel,
which is what most deployments need. To use GPU/Metal acceleration where
available, rebuild that one package with the appropriate flag:

```bash
# NVIDIA GPU (Linux/Windows)
cd rex && CMAKE_ARGS="-DGGML_CUDA=on" uv sync --reinstall-package llama-cpp-python

# Apple Silicon (Metal)
cd rex && CMAKE_ARGS="-DGGML_METAL=on" uv sync --reinstall-package llama-cpp-python
```

REx training and inference paths are unaffected by this; the GGUF backend
only powers the verbalization step.

## Data sources

ADDEx operates on three publicly available biomedical knowledge graphs:

- **Hetionet** — https://github.com/hetio/hetionet
- **PrimeKG** — https://github.com/mims-harvard/PrimeKG
- **OREGANO** — https://gitub.u-bordeaux.fr/erias/oregano

The domain ontologies used for ontological enrichment (NCIT, ChEBI, Gene
Ontology) are publicly available through their respective repositories.
Pre-processed versions of all datasets and ontologies, as used by ADDEx, are
included in the repository.

---


### How REx is invoked

The frontend talks to the bundled REx engine through internal API routes
(`src/app/api/`). On the first request for a new pair, REx is launched with
`uv` against the pre-trained models in `rex/saved_models/`. The engine writes
its raw paths to a scratch folder under `rex/output/<jobId>/`; the API then
merges those paths into the per-pair cache and deletes the scratch folder.

The cache itself lives at:

```
rex/saved_models/<dataset>/<task>/<persona>/pairs/<pairId>.json
```

Any subsequent request for the same `(dataset, task, persona, source, target)`
returns from disk in milliseconds — no GPU required. (`rex/output/` will
normally appear empty in steady state; that is the expected behaviour, the
real artifacts are under `saved_models/`.)

For details on the REx CLI, configs, and how to retrain a model, see
[`rex/README.md`](rex/README.md).

---

## Project structure

```
ADDEx/
├─ src/app/                  # Next.js 15 app router
│  ├─ page.tsx               # Homepage
│  ├─ pages/                 # Profile setup, dataset/task picker, search,
│  │                         # guide, software, about
│  ├─ components/            # Navbar, side menus, graph visualizer, settings
│  ├─ api/                   # Internal API routes (explanation-search,
│  │                         # personas, datasets, labels, drugbank-links, …)
│  └─ hooks/
├─ rex/                      # REx engine integration: pre-trained models,
│                            # configs, per-pair output cache, runtime jobs
├─ styles/                   # Theme tokens, palette, type-color maps
├─ public/                   # Static assets
└─ scripts/                  # One-off maintenance scripts
```

---

## Authors
- __Susana Nunes__
- __Mariana Gouveia__
- __Catia Pesquita__

For any comments or help needed with this implementation, please send an email to: scnunes@ciencias.ulisboa.pt


## Citation

If you use ADDEx in your research, please cite the platform paper *(coming
soon — full bibliographic record will appear here on publication)* alongside
the underlying methods:

- **REx** — *Rewarding Explainability in Drug Repurposing with Knowledge
  Graphs.* Nunes, Badreddine, Pesquita. IJCAI 2025.
  [doi:10.24963/ijcai.2025/515](https://doi.org/10.24963/ijcai.2025/515)
- **Adaptive REx** — *Agentic Personas for Adaptive Scientific
  Explanations with Knowledge Graphs.* Nunes, Guerreiro, Pesquita. arXiv
  preprint arXiv:2603.21846.

The **Research** page inside the app provides one-click BibTeX and APA
citations for both papers.

---


## Funding & acknowledgements

This work was supported by FCT through the fellowship
[2023.00653.BD](https://doi.org/10.54499/2023.00653.BD), and the LASIGE
Research Unit (ref. UID/00408/2025). It was also partially supported by the
**KATY** project (European Union Horizon 2020, grant agreement No. 101017453)
and the **CancerScan** project (European Union Horizon Europe / EIC Pathfinder
Open, grant agreement No. 101186829).

