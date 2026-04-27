"""Project package that also mirrors the stdlib ``code`` module API.

This repository uses ``code`` as its top-level package name, which shadows
Python's standard-library module of the same name when running from the repo
root. Some dependencies, such as ``pdb`` via PyTorch, import stdlib ``code``
and expect attributes like ``InteractiveConsole`` to exist.

To keep the existing project imports working without a larger package rename,
we eagerly load the stdlib implementation and copy its public API into this
package namespace.
"""

from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path
import sysconfig


def _load_stdlib_code_module():
    stdlib_dir = Path(sysconfig.get_path("stdlib"))
    code_py = stdlib_dir / "code.py"
    spec = spec_from_file_location("_stdlib_code", code_py)
    if spec is None or spec.loader is None:
        raise ImportError(f"Could not load stdlib code module from {code_py}")
    module = module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


_stdlib_code = _load_stdlib_code_module()

for _name in dir(_stdlib_code):
    if _name.startswith("__") and _name not in {"__all__", "__doc__"}:
        continue
    globals()[_name] = getattr(_stdlib_code, _name)

__all__ = getattr(
    _stdlib_code,
    "__all__",
    [name for name in globals() if not name.startswith("_")],
)
