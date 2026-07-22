# Contributing — how changes land in this repo

`main` is protected. You can't push to it directly. Every change — a token
sync, a build-config tweak, a doc fix — goes onto a branch, through a pull
request (PR), and is merged on GitHub only after the **build + verify** check
passes. This page is the whole workflow, start to finish.

## Why it works this way

The build + verify gate (`.github/workflows/ci.yml` → `npm test`) confirms the
Style Dictionary build produces all six `dist/` outputs and that every
`var(--…)` the site uses is defined. Requiring it on a PR means broken tokens
can't reach `main` — the gate is enforced by GitHub, not by remembering to run
it locally.

## The one thing to understand first: there are two `main`s

- **Local `main`** — the copy on your laptop.
- **`origin/main`** — the copy on GitHub (the real one everyone shares).

You never push to either `main` anymore. You push a *branch*, and GitHub merges
it into `origin/main` for you when you click **Merge**. Afterwards you *pull*
`origin/main` down so your local `main` catches up. So: branches go up via
`push`; `main` comes down via `pull`.

## The loop

```bash
# 1. Start from an up-to-date main
git checkout main
git pull

# 2. Make a branch for your change
git checkout -b my-change        # any short name: sync-tokens, fix-docs, etc.

# 3. Do the work, then commit
git commit -am "describe the change"

# 4. Push the BRANCH (not main) to GitHub
git push -u origin my-change
```

Then finish on GitHub (see next section), and when it's merged:

```bash
# 6. Bring your local main up to date with the merged change
git checkout main
git pull

# 7. (optional) delete the local branch
git branch -d my-change
```

## Opening and merging the PR (on GitHub)

A **pull request** is just a page that says "please merge my branch into
`main`." It shows what changed and runs the checks. It has nothing to do with
`git pull`.

1. After `git push`, open the repo on GitHub. A banner offers **"Compare & pull
   request"** — click it. (If it's gone: **Pull requests** tab → **New pull
   request** → base `main`, compare `my-change` → **Create pull request**.)
2. Give it a title (pre-filled from your commit) and click **Create pull
   request**.
3. In the checks box at the bottom, wait for **build + verify** to go green
   (usually under a minute).
4. Click **Merge pull request** → **Confirm merge**. This is what lands your
   change on `main` — it replaces the old `git push origin main`.
5. Click **Delete branch** to tidy up.

If the check fails, the **Merge** button stays disabled — nothing lands until
it's green. You can't break `main` by trying.

## Solo note

Branch protection is set with **Required approvals: 0**, so you can merge your
own PRs without a second reviewer. You still go through a PR (that's what runs
the gate), but you don't need anyone else to click approve.

## Gotcha: no-op build churn

Running `npm run build` / `npm test` locally re-stamps a timestamp in
`tokens/snapshot.json` and `dist/report.html`, and appends a `changeCount: 0`
entry to `tokens/changelog.json` — even when no token actually changed. If you
see only those three files modified after a build and no real token change,
discard them rather than committing noise:

```bash
git restore dist/report.html tokens/changelog.json tokens/snapshot.json
```

Only commit `tokens/changelog.json` / `snapshot.json` when a genuine token
change produced them.

## Releasing tokens (how consumers get them)

Consuming sites do **not** read this repo off the filesystem. They install it as a
pinned dependency straight from a git tag, e.g. in the site's `package.json`:

```json
"devDependencies": {
  "kirsten-rossiter-tokens": "github:Boyzeeboy/kr-token-pipeline#v0.2.0"
}
```

That pin is the contract: a site is on an exact, named version of the tokens and
only moves when you bump it. No sibling-folder paths, no "whatever happened to be
on disk".

### Versioning policy

`dist/` is committed, so a consumer installing from a tag gets built outputs with
no build step on their side. Version the *tokens*, not the machinery:

- **MAJOR** — a token is removed or renamed, or its meaning changes. Consumers
  referencing it will break.
- **MINOR** — new tokens added, or a new mode. Existing references keep working.
- **PATCH** — a token's *value* changes (a colour is retuned), or a build/doc fix.
  Visually different, but no reference breaks.

When in doubt between minor and major, ask: *would an existing `var(--kr-…)` in a
consuming site stop resolving?* If yes, it's major.

### Cutting a release

1. Land the token change through the normal PR flow above (so `build + verify`
   passes on it).
2. In a follow-up PR, bump `version` in `package.json` per the policy.
3. Once merged, tag the merge commit on `main` and push the tag:

```bash
git checkout main && git pull
git tag v0.2.0          # match the version in package.json
git push origin v0.2.0
```

4. In the consuming site, bump the pinned tag in `package.json`, then
   `npm install && npm run sync-tokens`, and commit the updated
   `vendor/tokens.css`.

### Do not add a `prepare` script

npm runs `prepare` when installing from a git URL. Because `dist/` is committed,
consumers need no build — and adding `prepare` would force this repo's
devDependencies (Storybook, Chromatic, Vite…) to install on every consumer. Keep
`prepublishOnly` for registry publishes only.

## Quick reference

| Action | Command |
| --- | --- |
| Start fresh from main | `git checkout main && git pull` |
| New branch | `git checkout -b my-change` |
| Commit | `git commit -am "…"` |
| Push the branch | `git push -u origin my-change` |
| Merge | on GitHub: open PR → wait for green → **Merge** |
| Sync local main after merge | `git checkout main && git pull` |
| Drop no-op build churn | `git restore dist/report.html tokens/changelog.json tokens/snapshot.json` |
| Clear a stale git lock | `find .git -name '*.lock' -delete` |
