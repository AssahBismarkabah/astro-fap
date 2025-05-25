---
title: Programmatically Accessing Heroku PostgreSQL from GitHub Actions
date: 2023-10-01
layout: ../../../layouts/DocsLayout.astro
---

# Programmatically Accessing Heroku PostgreSQL from GitHub Actions

The [db-to-sqlite](https://github.com/simonw/db-to-sqlite) tool can connect to a PostgreSQL database, export all of the content, and write it to a SQLite database file on disk. This guide demonstrates how to integrate this process into a GitHub Actions workflow, allowing programmatic access to a Heroku PostgreSQL database.

## Overview

Heroku provides a `DATABASE_URL` environment variable that contains all the necessary information to connect to the PostgreSQL database from external sources. We can leverage this in our GitHub Actions workflow.

## Local Usage

If you have the Heroku CLI installed and authenticated, you can use the following command:

```bash
db-to-sqlite $(heroku config:get DATABASE_URL -a your-app-name) output.db
```

## Setting Up GitHub Actions

To use this in a GitHub Action, follow these steps:

### 1. Create a Heroku API Key

Generate a long-lived OAuth token with read-protected scope:

```bash
heroku authorizations:create --scope=read-protected
```

Copy the generated token and add it as a secret in your GitHub repository with the name `HEROKU_API_KEY`.

### 2. Configure the Workflow

Create a `.github/workflows/db-export.yml` file in your repository with the following content:

```yaml
name: Export Heroku DB to SQLite
on:
  workflow_dispatch:

jobs:
  export-db:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.x'

      - name: Install dependencies
        run: |
          pip install 'db-to-sqlite[postgresql]'
          pip install heroku3

      - name: Export Heroku DB to SQLite
        env:
          HEROKU_API_KEY: ${{ secrets.HEROKU_API_KEY }}
        run: |
          db-to-sqlite $(heroku config:get DATABASE_URL -a your-app-name) output.db \
            --table auth_permission \
            --table auth_user \
            --table blog_blogmark \
            --table blog_blogmark_tags \
            --table blog_entry \
            --table blog_entry_tags \
            --table blog_quotation \
            --table blog_quotation_tags \
            --table blog_tag \
            --table django_content_type \
            --table redirects_redirect

      - name: Upload SQLite database
        uses: actions/upload-artifact@v3
        with:
          name: database
          path: output.db
```

Replace `your-app-name` with your actual Heroku app name.

## Key Points

- The `HEROKU_API_KEY` is securely accessed from GitHub Secrets.
- Specify tables to export using the `--table` option. You can list multiple tables as shown in the example.
- The resulting SQLite database is uploaded as an artifact, making it available for download or use in subsequent workflow steps.

## Additional Notes

- To export all tables, use the `--all` flag instead of specifying individual tables:

```bash
db-to-sqlite $(heroku config:get DATABASE_URL -a your-app-name) output.db --all
```

- This workflow is triggered manually using `workflow_dispatch`. You can modify the trigger based on your needs, such as running on push to a specific branch or on a schedule.

By following this guide, you can automate the process of exporting your Heroku PostgreSQL database to SQLite using GitHub Actions, enabling easy backups or data processing as part of your workflow.
