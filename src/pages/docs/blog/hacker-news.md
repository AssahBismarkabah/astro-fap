---
layout: ../../../layouts/BlogPostLayout.astro
title: How to Read Hacker News Threads with Most Recent Comments First
date: 2025-03-20
description: Learn how to read HN threads in reverse chronological order.
category: technical
---

[Hacker News](https://news.ycombinator.com/) displays comments in a tree structure, which can make it difficult to track the latest updates in a conversation. To address this, I explored three different methods to sort and read Hacker News comments by most recent first. Here's how you can do it, starting from the simplest approach.

## 1. The Easiest Way: Algolia Search

Hacker News uses Algolia for its search functionality, which has a continuously updated index. You can use this to display comments for a specific story in reverse chronological order.
For example, to view comments for the story with ID `35111646`, you can use the following URL:
[https://hn.algolia.com/?dateRange=all&page=0&prefix=false&query=story:35111646&sort=byDate&type=comment](https://hn.algolia.com/?dateRange=all&page=0&prefix=false&query=story:35111646&sort=byDate&type=comment)

You can replace `35111646` with the story ID of your choice. This method provides a straightforward way to browse comments by date.

![Screenshot of Algolia search results](https://user-images.githubusercontent.com/9599/224572085-d1e57f95-427c-4c62-9a2e-d2e8c4ab8f90.png)

## 2. Using the Algolia `search_by_date` API

For a programmatic solution, you can use the Algolia Hacker News API, which is separate from the official Hacker News API. This API provides a `search_by_date` endpoint for retrieving comments sorted by date in JSON format.
For example:
```json
https://hn.algolia.com/api/v1/search_by_date?tags=comment,story_35111646&hitsPerPage=1000
```
The `tags` parameter specifies the story ID and filters for comments. Adding `&hitsPerPage=1000` retrieves up to 1,000 comments in one request.

### Viewing JSON Data in Datasette Lite

To make this data more readable, you can use [Datasette Lite](https://lite.datasette.io/), which runs Datasette directly in your browser. Simply pass the JSON URL as a query parameter:

[https://lite.datasette.io/?json=https://hn.algolia.com/api/v1/search_by_date?tags=comment%2Cstory_35111646](https://lite.datasette.io/?json=https://hn.algolia.com/api/v1/search_by_date?tags=comment%2Cstory_35111646)

Datasette Lite converts the JSON data into a table, allowing you to browse and filter comments easily.

![Datasette Lite table view](https://user-images.githubusercontent.com/9599/224572148-0088593f-45a0-4456-83c8-5294d391ce87.png)

### Enhancing Readability with Plugins and SQL

Datasette Lite supports plugins to improve data visualization. For example, you can use `datasette-simple-html` and `datasette-json-html` to render HTML and create links for easier navigation.
Here's an example SQL query to enhance readability:

```sql
select
  json_object(
    'label', objectID,
    'href', 'https://news.ycombinator.com/item?id=' || objectID
  ) as link,
  created_at,
  author,
  html_unescape(
    html_strip_tags(comment_text)
  ) as text,
  parent_id
from
  search_by_date
order by
  created_at desc
```

[Click here to see the results](https://lite.datasette.io/?install=datasette-simple-html&install=datasette-json-html&json=https://hn.algolia.com/api/v1/search_by_date?tags=comment%2Cstory_35111646%26hitsPerPage=100#/data?sql=select%0A++json_object%28%0A++++%27label%27%2C+objectID%2C%0A++++%27href%27%2C+%27https%3A%2F%2Fnews.ycombinator.com%2Fitem%3Fid%3D%27+%7C%7C+objectID%0A++%29+as+link%2C%0A++created_at%2C%0A++author%2C%0A++html_unescape%28%0A++++html_strip_tags%28comment_text%29%0A++%29+as+text%2C%0A++parent_id%0Afrom%0A++search_by_date%0Aorder+by%0A++created_at+desc).

This query includes clickable links to comments on Hacker News.

## 3. Advanced Solution: Flattening Nested JSON with `json_tree()`

Algolia's `items` API returns a nested JSON object representing the entire thread:

```
https://hn.algolia.com/api/v1/items/35111646
```

Datasette Lite can parse nested JSON arrays into a table. You can further flatten this data using SQLite's `json_tree()` function.

Here's an example query to extract and organize the nested comments:

```sql
with items as (select * from [35111646]),
results as (
select
  json_extract(value, '$.id') as id,
  json_extract(value, '$.created_at') as created_at,
  json_extract(value, '$.author') as author,
  html_strip_tags(html_unescape(json_extract(value, '$.text'))) as text,
  json_extract(value, '$.parent_id') as parent_id
from
  items, json_tree(items.children) tree
where
  tree.type = 'object'
)
select * from results
order by created_at desc;
```

This query flattens the nested JSON and sorts the comments by creation date.

## Conclusion

Each method provides a different level of control and complexity for reading Hacker News threads with the most recent comments first. Whether you prefer a simple URL, an API integration, or advanced JSON manipulation, these solutions can help you navigate and stay updated on conversations more efficiently.
This post was originally written by [Simon](https://github.com/simonw). Iliked the post and wanted to add it here for future reference.
