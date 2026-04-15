#!/usr/bin/env bash
set -euo pipefail

# Publishes the next unpublished dev.to draft.
# Run daily via cron: 0 9 * * * /path/to/publish-next.sh
#
# Requires: DEVTO_API_KEY env var

DEVTO_API_KEY="${DEVTO_API_KEY:?Set DEVTO_API_KEY}"

# Get all unpublished articles
drafts=$(curl -s "https://dev.to/api/articles/me/unpublished?per_page=50" \
  -H "api-key: ${DEVTO_API_KEY}")

# Get the oldest draft (first in list = oldest)
article_id=$(echo "${drafts}" | jq -r 'sort_by(.created_at) | .[0].id // empty')

if [[ -z "${article_id}" ]]; then
  echo "No unpublished drafts remaining."
  exit 0
fi

title=$(echo "${drafts}" | jq -r "sort_by(.created_at) | .[0].title")

# Publish it
curl -s -X PUT "https://dev.to/api/articles/${article_id}" \
  -H "api-key: ${DEVTO_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"article":{"published":true}}' > /dev/null

echo "Published: ${title} (id: ${article_id})"
