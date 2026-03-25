# Five-Star Battery Data

This repository is now structured as a Battery Genome learning-content package for native rendering under `/learn/courses/five-star-battery-data`.

## Source of Truth

The course structure is defined by:

- `course.json`
- `modules/*/module.json`
- `exports/learning-manifest.json`
- `preview/`

Those files replace Sphinx navigation as the effective API for course ingestion. The legacy `mooc/` tree is still present during migration, but it should be treated as a compatibility snapshot rather than the primary product shell.

## Course Summary

Five-Star Battery Data is a self-paced course for researchers, developers, and data stewards who want to make battery datasets more open, structured, and machine-actionable.

The course follows the Five-Star Battery Data ladder:

1. Publish your data on the web with a permissive license
2. Use structured data such as tables and JSON
3. Use open formats such as CSV, JSON, Parquet, and HDF5
4. Describe your data with ontologies
5. Link your data to other relevant resources

## Repository Layout

```text
five-star-battery-data/
  course.json
  assets/
  preview/
  modules/
    course/
    introduction/  # lesson assets retained during migration
    star-1/
    star-2/
    star-3/
    star-4/
    star-5/
    capstone/
  exports/
  mooc/        # legacy Sphinx source retained during migration
```

## Preview

The default local preview is the platform-aligned static experience in `preview/`, not the legacy Sphinx shell.

```powershell
python scripts/generate_learning_export.py
python -m http.server 8008
```

Then open `http://127.0.0.1:8008/preview/`.

Sphinx can still be used as a compatibility preview for the old MOOC shell, but it is no longer the recommended local review surface.

## Ingestion

The Battery Genome platform can ingest this repository from `course.json` and the per-module manifests, or consume the consolidated export:

```powershell
python scripts/generate_learning_export.py
```

The generated export is written to `exports/learning-manifest.json`.

## License

Course content is licensed under Creative Commons Attribution 4.0 International (CC BY 4.0) unless otherwise stated. See `LICENSE.txt`.
