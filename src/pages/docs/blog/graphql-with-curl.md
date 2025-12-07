---
layout: ../../../layouts/BlogPostLayout.astro
title: How to use cURL to interact with GraphQL APIs.
date: 2023-01-05
description: How to use cURL to interact with GraphQL APIs.
category: technical
---


Running GraphQL queries from the command line using `curl` can be made simple and readable. Here's an example of how to query the GitHub GraphQL API using `curl`, tested in both `bash` and `zsh`. Replace `TOKEN` with your GitHub API personal access token.

```bash
curl -s https://api.github.com/graphql -X POST \
-H "Authorization: Bearer TOKEN" \
-H "Content-Type: application/json" \
-d "$(jq -c -n --arg query '
{
  search(type: REPOSITORY, query: "user:assahw topic:git-scraping", first: 100) {
    repositoryCount
    nodes {
      __typename
      ... on Repository {
        nameWithOwner
        description
        defaultBranchRef {
          name
          target {
            ... on Commit {
              committedDate
              url
              message
            }
          }
        }
      }
    }
  }
}' '{"query":$query}')"
```

This command constructs and submits a GraphQL query encoded in JSON, using `jq` for JSON handling.

## Building a JSON Document with jq

The query needs to be encoded as a JSON document like this:

```json
{"query":"\n{\n  search(type: REPOSITORY, query: \"user:assah topic:git-scraping\", first: 100) {\n    repositoryCount\n    nodes {\n      __typename\n      ... on Repository {\n        nameWithOwner\n        description\n        defaultBranchRef {\n          name\n          target {\n            ... on Commit {\n              committedDate\n              url\n              message\n            }\n          }\n        }\n      }\n    }\n  }\n}"}
```

This is generated using the following `jq` command:

```bash
jq -c -n --arg query '
{
  search(type: REPOSITORY, query: "user:assah topic:git-scraping", first: 100) {
    repositoryCount
    nodes {
      __typename
      ... on Repository {
        nameWithOwner
        description
        defaultBranchRef {
          name
          target {
            ... on Commit {
              committedDate
              url
              message
            }
          }
        }
      }
    }
  }
}' '{"query":$query}'
```

### Explanation of jq Options

- `-c`: Produces compact JSON output.
- `-n`: Creates JSON from scratch without reading input.
- `--arg`: Sets a variable within `jq` to a specified string.
- The final JSON document is constructed using `{"query":$query}`.

## Passing JSON to curl with "$()"

The JSON document is passed to `curl` using the `-d` option:

```bash
-d "$(jq -c -n --arg query ...)"
```

The `"$(...)"` syntax ensures that the entire JSON output is treated as a single value, even with internal whitespace or quotes.

## Example JSON Output

A truncated example of the JSON response:

```json
{
  "data": {
    "search": {
      "repositoryCount": 22,
      "nodes": [
        {
          "__typename": "Repository",
          "nameWithOwner": "assah/csv-diff",
          "description": "Python CLI tool and library for diffing CSV and JSON files",
          "defaultBranchRef": {
            "name": "main",
            "target": {
              "committedDate": "2021-02-23T02:53:11Z",
              "url": "https://github.com/assahw/csv-diff/commit/33e0a5918283c02a339a1fb507fc7a9cda89a198",
              "message": "Handle missing JSON keys, refs #13"
            }
          }
        }
      ]
    }
  }
}
```

## Combining with sqlite-utils insert

To create a SQLite database with records for repositories tagged `git-scraping`, use:

```bash
curl https://api.github.com/graphql -X POST \
-H "Authorization: Bearer ..." \
-H "Content-Type: application/json" \
-d "$(jq -c -n --arg query '
{
  search(type: REPOSITORY, query: "user:assah topic:git-scraping", first: 100) {
    repositoryCount
    nodes {
      __typename
      ... on Repository {
        nameWithOwner
        description
        defaultBranchRef {
          name
          target {
            ... on Commit {
              committedDate
              url
              message
            }
          }
        }
      }
    }
  }
}' '{"query":$query}')" \
  | jq .data.search.nodes | sqlite-utils insert /tmp/github.db repos - --flatten
```

### Explanation

- `jq .data.search.nodes`: Extracts the `nodes` array from the JSON response.
- `sqlite-utils insert /tmp/github.db repos - --flatten`: Inserts the array into a SQLite database table named `repos`. The `--flatten` option ensures nested fields are expanded into columns.

### Final Table Schema

The resulting SQLite table schema:

```sql
CREATE TABLE [repos] (
   [__typename] TEXT,
   [nameWithOwner] TEXT,
   [description] TEXT,
   [defaultBranchRef_name] TEXT,
   [defaultBranchRef_target_committedDate] TEXT,
   [defaultBranchRef_target_url] TEXT,
   [defaultBranchRef_target_message] TEXT
);
```
This post was originally written by [Simon](https://github.com/simonw). Iliked the post and wanted to add it here for future reference.
