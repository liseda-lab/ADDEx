from __future__ import annotations

import contextlib
import io
import json
import os
import re
import sys
from typing import Any
import platform

try:
    import ctypes
except ImportError:
    ctypes = None

REX_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if REX_ROOT not in sys.path:
    sys.path.insert(0, REX_ROOT)

from code.model import environment as rex_environment


def _memory_snapshot() -> str:
    try:
        if platform.system() == "Windows" and ctypes is not None:
            class MEMORYSTATUSEX(ctypes.Structure):
                _fields_ = [
                    ("dwLength", ctypes.c_ulong),
                    ("dwMemoryLoad", ctypes.c_ulong),
                    ("ullTotalPhys", ctypes.c_ulonglong),
                    ("ullAvailPhys", ctypes.c_ulonglong),
                    ("ullTotalPageFile", ctypes.c_ulonglong),
                    ("ullAvailPageFile", ctypes.c_ulonglong),
                    ("ullTotalVirtual", ctypes.c_ulonglong),
                    ("ullAvailVirtual", ctypes.c_ulonglong),
                    ("sullAvailExtendedVirtual", ctypes.c_ulonglong),
                ]

            stat = MEMORYSTATUSEX()
            stat.dwLength = ctypes.sizeof(MEMORYSTATUSEX)
            if ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(stat)):
                gib = 1024 ** 3
                return (
                    f"mem_load={stat.dwMemoryLoad}% "
                    f"avail_phys={stat.ullAvailPhys / gib:.2f}GiB "
                    f"avail_page={stat.ullAvailPageFile / gib:.2f}GiB "
                    f"avail_virtual={stat.ullAvailVirtual / gib:.2f}GiB"
                )
    except Exception as exc:
        return f"memory_snapshot_error={exc}"

    return "memory_snapshot_unavailable"


def _read_payload() -> dict[str, Any]:
    try:
        raw = sys.stdin.read()
        return json.loads(raw)
    except Exception as exc:
        raise RuntimeError(f"Failed to read request payload: {exc}") from exc


def _configure_llm(payload: dict[str, Any]) -> None:
    llm_api = bool(payload.get("llm_api", False))
    llm_model = str(payload.get("llm_model", "qwen") or "qwen")
    local_model = str(payload.get("local_model", "Qwen/Qwen3-1.7B") or "Qwen/Qwen3-1.7B")

    rex_environment._local_model_name = local_model
    if llm_api:
        if llm_model == "gpt":
            rex_environment._call_llm = rex_environment._call_llm_gpt_api
        else:
            rex_environment._call_llm = rex_environment._call_llm_qwen_api
    else:
        rex_environment._call_llm = rex_environment._call_llm_local
    print(
        "[GlobalExplanationPy] LLM configured "
        f"(llm_api={llm_api}, llm_model={llm_model}, local_model={local_model})",
        file=sys.stderr,
    )
    print(f"[GlobalExplanationPy] Memory snapshot after config: {_memory_snapshot()}", file=sys.stderr)


def _generate_with_llm(messages: list[dict[str, str]], payload: dict[str, Any]) -> str:
    llm_api = bool(payload.get("llm_api", False))

    if rex_environment._call_llm is None:
        raise RuntimeError("The REX LLM backend is not available in this environment.")

    if llm_api:
        with contextlib.redirect_stdout(sys.stderr):
            _, raw_text = rex_environment._call_llm(messages, temperature=0.2)
        explanation = (raw_text or "").strip()
        if not explanation:
            raise RuntimeError("The LLM returned an empty explanation.")
        return explanation

    redirected = io.StringIO()
    print(f"[GlobalExplanationPy] Trying local model: {rex_environment._local_model_name}", file=sys.stderr)
    print(f"[GlobalExplanationPy] Memory before model call: {_memory_snapshot()}", file=sys.stderr)
    with contextlib.redirect_stdout(redirected):
        _, raw_text = rex_environment._call_llm(messages, temperature=0.2)
    redirected_output = redirected.getvalue().strip()
    if redirected_output:
        print(redirected_output, file=sys.stderr)
    explanation = (raw_text or "").strip()
    if not explanation:
        raise RuntimeError(redirected_output or "The LLM returned an empty explanation.")
    print(
        f"[GlobalExplanationPy] Generation succeeded with {rex_environment._local_model_name}.",
        file=sys.stderr,
    )
    print(f"[GlobalExplanationPy] Memory after model call: {_memory_snapshot()}", file=sys.stderr)
    return explanation


def _load_persona_text(persona_path: str) -> str:
    if not persona_path:
        return ""

    resolved = persona_path
    if not os.path.isabs(resolved):
        resolved = os.path.join(os.getcwd(), persona_path)

    if not os.path.isfile(resolved):
        return ""

    with open(resolved, "r", encoding="utf-8") as handle:
        return handle.read().strip()


def _format_paths(paths: list[dict[str, Any]], visible_lcas: set[str]) -> str:
    sections: list[str] = []

    for index, path in enumerate(paths, start=1):
        edge_lines: list[str] = []
        for edge in path.get("edges", []):
            if edge.get("type") == "LCA":
                continue
            edge_lines.append(
                f"- {edge.get('source', '')} --{edge.get('label', '')}--> {edge.get('target', '')}"
            )

        lca_lines: list[str] = []
        for key, lca_values in (path.get("lowest_common_ancestors") or {}).items():
            source_nodes = [part.strip() for part in key.split(",") if part.strip()]
            entries = lca_values if isinstance(lca_values, list) else [lca_values]
            for lca_name in entries:
                if not lca_name or lca_name not in visible_lcas:
                    continue
                joined_sources = ", ".join(source_nodes)
                lca_lines.append(f"- Lowest common ancestor: {joined_sources} -> {lca_name}")

        score = path.get("score", {}) or {}
        score_text = []
        for key in ("final_score", "scientific_validity", "completeness", "relevance"):
            value = score.get(key)
            if value is not None:
                score_text.append(f"{key}={value}")

        block = [f"Path {index} ({path.get('id', f'path-{index}')}):"]
        if score_text:
            block.append("Scores: " + ", ".join(score_text))
        block.extend(edge_lines or ["- No non-LCA edges were provided."])
        block.extend(lca_lines)
        sections.append("\n".join(block))

    return "\n\n".join(sections)


def _looks_like_internal_id(value: str) -> bool:
    return "::" in value


def _clean_internal_id(value: str) -> str:
    if "::" not in value:
        return value
    return value.split("::", 1)[0].strip() or value


def _resolve_endpoint_name(paths: list[dict[str, Any]], fallback: str, position: str) -> str:
    for path in paths:
        nodes = path.get("nodes", [])
        if not isinstance(nodes, list) or not nodes:
            continue

        candidate_node = nodes[0] if position == "first" else nodes[-1]
        if not isinstance(candidate_node, dict):
            continue

        candidate = str(candidate_node.get("id", "")).strip()
        if candidate:
            return candidate

    return _clean_internal_id(fallback)


def _remove_internal_ids(text: str, source: str, target: str, source_display: str, target_display: str) -> str:
    result = text.strip()

    if source and source_display and source != source_display:
        result = result.replace(source, source_display)
    if target and target_display and target != target_display:
        result = result.replace(target, target_display)

    # Replace remaining TYPE::CODE patterns with TYPE.
    result = re.sub(r"\b([A-Za-z][A-Za-z\s/_-]*)::[A-Za-z0-9:._-]+\b", r"\1", result)
    return result


def main() -> int:
    try:
        payload = _read_payload()
        print("[GlobalExplanationPy] Payload received.", file=sys.stderr)
        print(f"[GlobalExplanationPy] Initial memory snapshot: {_memory_snapshot()}", file=sys.stderr)
        _configure_llm(payload)

        dataset = str(payload.get("dataset", ""))
        task = str(payload.get("task", ""))
        persona = str(payload.get("persona", ""))
        source = str(payload.get("source", ""))
        target = str(payload.get("target", ""))
        paths = payload.get("paths", [])
        visible_lcas = set(payload.get("visibleLCAs", []) or [])
        persona_text = _load_persona_text(str(payload.get("persona_path", "")))

        if not source or not target:
            raise RuntimeError("Source and target are required.")
        if not isinstance(paths, list) or not paths:
            raise RuntimeError("At least one visible path is required.")

        source_display = _resolve_endpoint_name(paths, source, "first")
        target_display = _resolve_endpoint_name(paths, target, "last")

        print(
            f"[GlobalExplanationPy] Building explanation for {source_display} -> {target_display} "
            f"with {len(paths)} path(s).",
            file=sys.stderr,
        )

        prompt_sections = [
            "You are generating one global biomedical explanation from the currently visible graph paths.",
            "Summarize the combined evidence across all visible paths, not one explanation per path.",
            "Use only the provided paths and LCA context. Do not mention hidden paths or unavailable evidence.",
            "Write 1 to 3 short paragraphs in clear scientific language.",
            "Mention recurring mechanisms, complementary evidence, and uncertainty when appropriate.",
            "Do not use bullet points.",
            "Never include internal identifiers such as TYPE::CODE, DB IDs, DOID IDs, or pair IDs in the final explanation.",
        ]

        if persona_text:
            prompt_sections.append("Style the explanation according to this persona guidance:\n" + persona_text)

        user_prompt = (
            f"Dataset: {dataset}\n"
            f"Task: {task}\n"
            f"Persona: {persona}\n"
            f"Source entity: {source_display}\n"
            f"Target entity: {target_display}\n\n"
            "Visible path evidence:\n"
            f"{_format_paths(paths, visible_lcas)}\n\n"
            "Produce one integrated explanation for why the visible evidence may support a relationship "
            f"between {source_display} and {target_display}."
        )

        explanation = _generate_with_llm(
            [
                {"role": "system", "content": "\n".join(prompt_sections)},
                {"role": "user", "content": user_prompt},
            ],
            payload,
        )
        explanation = _remove_internal_ids(
            explanation,
            source,
            target,
            source_display,
            target_display,
        )

        print("[GlobalExplanationPy] Returning explanation payload.", file=sys.stderr)
        print(json.dumps({"explanation": explanation}, ensure_ascii=False))
        return 0
    except Exception as exc:
        print(json.dumps({"error": str(exc)}, ensure_ascii=False), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
