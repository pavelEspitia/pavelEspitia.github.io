# Distribution

Cross-posting validated dev.to content to other channels. The bottleneck was
never writing, it was distribution: 44 posts, 3k views, most of it in 1-2 posts.
This folder moves the posts that already won.

## Cadence

- **Mon / Thu**: 1 LinkedIn post (native text, link in first comment)
- **Wed**: 1 niche-community post (Reddit / HN, adapted copy in `community/`)
- Daily dev.to cron keeps publishing new drafts (that's production, not distribution)

## LinkedIn (`linkedin/`)

Each `.md` is the post body, ready to fire with the bot:

```bash
cd ~/launch-assets/linkedin-bot
DRY_RUN=1 node post.mjs ~/projects/pavelEspitia.github.io/distribution/linkedin/01-ollama-local.md  # preview
node post.mjs ~/projects/pavelEspitia.github.io/distribution/linkedin/01-ollama-local.md            # publish
```

Right after posting, paste the matching link from `linkedin/_first-comments.md`
as the first comment.

## Refresh the top-posts list

`weekly-repost.mjs` pulls the current top performers from the dev.to API so you
always repost what's actually working, not a stale list:

```bash
node distribution/weekly-repost.mjs        # prints top N + suggested channels
node distribution/weekly-repost.mjs --gen  # also scaffolds linkedin/ drafts for new entries
```

## Community (`community/`)

Reddit and Hacker News penalize copy-paste link drops. Those posts lead with
value and mention the link plainly. Adapted per subreddit.
