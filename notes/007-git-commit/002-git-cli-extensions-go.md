---
title: git CLI extensions - Go
---
--- message ---
role: user
---
I want to create a cli command that help me with the commit message when I create git commit. It will send the diff to an LLM to summarise the changes and will present it to the user for approval. what is the most appropriate method to implement it? I know that git has some cli extensions that may be employed here instead of writing new bash script for example. what are the options to implement it?

--- message ---
role: assistant
---
You’ve basically got three “native” integration points with Git, plus a couple of common CLI patterns. The right choice depends on how seamless you want it to feel and how much control you need over the commit lifecycle.

## 1) Git hook (most “Git-native” for commit-message generation)
**Best when:** you want this to happen automatically during `git commit`, without a new command users must remember.

### Typical approach
- Use **`prepare-commit-msg`** (or **`commit-msg`**) hook.
- Generate a proposed message from the staged diff (`git diff --cached`), write it into the commit message file Git provides to the hook.
- Git then opens the editor (or uses `-m`) with your proposed message present; user can approve/edit.

### Pros
- Works with normal `git commit` flows.
- No need to teach developers a new command.
- Can enforce policies in `commit-msg` if desired.

### Cons
- Hooks are not automatically shared (unless you distribute via tooling like `core.hooksPath`, a repo script, or something like `pre-commit`).
- Calling an LLM from a hook adds latency and introduces network failure cases during commits.

**Hooks to consider**
- `prepare-commit-msg`: ideal for *pre-filling* the message.
- `commit-msg`: ideal for *validating* or *blocking* commits if message doesn’t meet criteria (less ideal for generation).

**Key implementation detail:** use *staged* changes, not working tree:
```sh
git diff --cached
```

## 2) Git “porcelain” subcommand via `git-<name>` (best UX as a Git extension command)
**Best when:** you want a Git-like command such as `git ai-commit` or `git smart-commit`.

### How it works
Git automatically discovers executables on your `PATH` named:
- `git-foo` → callable as `git foo`

So you ship a standalone CLI binary/script called `git-ai-commit` and users run:
- `git ai-commit`

Your tool can:
1. Compute staged diff (`git diff --cached`)
2. Ask LLM for a message
3. Show proposed message for approval/edit
4. Run `git commit -m ...` (or open editor with template)

### Pros
- Very idiomatic Git UX.
- Easy to distribute (brew/npm/pip/cargo/go install).
- Doesn’t interfere with normal `git commit` unless user opts in.

### Cons
- Users must remember to use `git ai-commit` instead of `git commit` (unless combined with hooks).

## 3) Wrapper command / alias around `git commit` (simple but can be brittle)
**Best when:** you want “`git commit` but smarter” without hooks.

### Options
- Shell alias: `alias gitcommit='mytool commit'` (not great)
- Git alias in config:
  - `git config alias.ci '!mytool commit'`
  - then user runs `git ci`

### Pros
- Very easy to start.
- Doesn’t require hooks.

### Cons
- Aliases are less discoverable and less portable.
- Wrapping `git commit` fully (including all flags/edge cases) can get messy.

## 4) Git commit template approach (good hybrid, low-risk)
**Best when:** you want to suggest a message without blocking or deeply integrating.

- Generate a message into a temp file and launch:
  - `git commit -t /path/to/template`
- Or configure `commit.template`, then update that file before commit.

### Pros
- Keeps user in control and uses standard editor flow.
- Non-invasive.

### Cons
- Still requires users to run your command (unless hook updates template automatically).

## 5) Use an existing hook manager/distribution mechanism (for teams)
If you like hooks but want them reliably installed:
- **`pre-commit` framework** (popular, cross-platform)
- **lefthook**, **husky** (more common in JS ecosystems)
- Set repo-local hooks directory:
  - `git config core.hooksPath .githooks`
  - commit your `.githooks/prepare-commit-msg`

This solves the “hooks aren’t shared” problem.

## 6) Use Git’s credential/config ecosystem for API keys and settings
Regardless of approach, you’ll want configuration:
- API key via env var (`OPENAI_API_KEY`, etc.)
- Or git config:
  - `git config --global aiCommit.model gpt-4.1-mini`
  - `git config --global aiCommit.provider openai`
- Consider using OS keychain/secret storage rather than plaintext.

## Practical recommendation
If you want the **most appropriate and Git-native** method for “help me write the message during `git commit`”:

1. **Use `prepare-commit-msg` hook** to prefill the message from the *staged diff*, then open the editor for approval.
2. Package it with a **hook installer** (e.g., `pre-commit` or `core.hooksPath`) so it’s easy to adopt across machines.
3. Optionally also ship a **`git ai-commit`** command for people who don’t want hooks or want explicit behavior.

That combination gives you both:
- automatic integration (`git commit`)
- explicit opt-in command (`git ai-commit`)

## A few design notes that matter a lot
- Send **staged** diff only, and consider truncation/summary if diff is huge.
- Avoid running on merge commits / reverts unless intended (hooks get called there too).
- Provide a fallback if LLM fails (don’t block commits by default).
- Respect conventional commits if your team uses them (e.g., `feat:`, `fix:`).

If you tell me your preferred language (Node/Python/Go/Rust) and whether you want it to run on every `git commit` or only via `git ai-commit`, I can outline an implementation skeleton and the exact hook script/command flow.

--- message ---
role: user
---
if I create Go executable, running as git ai-commit, will I be able to configure it as a hook too?

--- message ---
role: assistant
---
Yes. A Go executable that works as a Git subcommand (e.g., `git ai-commit`) can also be used as a hook—hooks are just executables that Git runs at specific times.

## How it works
- `git ai-commit` works because Git searches your `PATH` for an executable named `git-ai-commit`.
- Hooks work because Git executes a file at `.git/hooks/<hook-name>` (or in `core.hooksPath`) and passes arguments + environment variables.

So you can reuse the same Go binary in both modes.

## Two common ways to wire it as a hook

### Option A: Put a small hook script that calls your Go binary (recommended)
Example `prepare-commit-msg` hook:

```sh
#!/bin/sh
exec git-ai-commit hook prepare-commit-msg "$@"
```

Then your Go program supports a “hook mode”, e.g.:

- `git-ai-commit hook prepare-commit-msg <msgfile> <source> <sha>`

Pros:
- Hook stays tiny and portable.
- Your Go binary contains the logic and can be versioned/updated independently.

### Option B: Make the hook be a symlink/copy to the binary
You can symlink `.git/hooks/prepare-commit-msg` → `/usr/local/bin/git-ai-commit` (or wherever it’s installed) and have your binary detect which hook it’s running as (via argv[0]) or require args.

Pros:
- No shell script.
Cons:
- Symlinks can be awkward on Windows; copying can get out of date.

## Where to install hooks (important)
Hooks inside `.git/hooks` are not shared via git. Typical team-friendly solutions:

- **Repo-managed hooks directory**
  - commit scripts under `.githooks/`
  - `git config core.hooksPath .githooks`

- **Installer command**
  - your tool provides `git ai-commit install-hook` that writes the hook file and sets `core.hooksPath` or populates `.git/hooks/`

- **Hook managers** (optional)
  - `pre-commit`, `lefthook`, etc. (then your Go binary is just “the thing they run”)

## Which hook to use for your feature
For “generate a commit message and let the user approve/edit”, the best fit is usually:
- **`prepare-commit-msg`**: it can *edit the message file before the editor opens*.

Your hook invocation will receive the commit message file path as the first arg; you write your suggested message into that file.

## Practical UX pattern (works well)
- `git ai-commit` (explicit command): does staging checks, generates message, prompts user, then runs `git commit ...`.
- Hook mode (`prepare-commit-msg`): auto-prefills message when user runs normal `git commit`.

You can share the same core logic but have slightly different behavior:
- In hook mode you must be careful not to break non-interactive commits (`git commit -m`, CI, etc.), so you usually *prefill* and avoid interactive prompts unless you detect a TTY.

If you tell me whether you want the hook to be interactive (prompt approval) or just prefill the editor, I can suggest the exact control flow and how to handle edge cases like `-m`, merges, rebases, and empty staged diffs.

--- message ---
role: user
---
I want just to prefill the editor. Create Go cli tool git-ai-commit that reads the LLM endpoint, model name and API key from git config keys; prepare a prompt from the diff of the staged files; query the LLM and prefill the editor with the response

--- message ---
role: assistant
---
### Recommended integration point: `prepare-commit-msg`
Use a **`prepare-commit-msg`** hook that runs your Go binary. This hook is specifically meant to *populate/edit the commit message file before the editor opens*.

Hook signature (args passed by Git):

```
prepare-commit-msg <commit-msg-file> [<source> [<sha1>]]
```

Your tool should:
1. Read the commit message file path from arg1
2. Decide whether to act (skip merges/squashes/etc. if desired)
3. Compute staged diff (`git diff --cached ...`)
4. Build prompt
5. Call LLM
6. Write the result into the commit message file (prefill)

---

## 1) Git config keys (API endpoint, model, key)
Pick a stable prefix, e.g. `ai-commit.*`:

```bash
git config --global ai-commit.endpoint "https://api.openai.com/v1/chat/completions"
git config --global ai-commit.model "gpt-4o-mini"
git config --global ai-commit.apiKey "YOUR_KEY"
# optional controls
git config --global ai-commit.maxDiffBytes "200000"
git config --global ai-commit.timeoutSeconds "30"
```

In Go, read with:

- `git config --get ai-commit.endpoint`
- `git config --get ai-commit.model`
- `git config --get ai-commit.apiKey`

(You can also support `--global`/`--local` overrides later, but `git config --get` already resolves the effective value.)

---

## 2) Install the hook (thin shell wrapper)
Put this in `.git/hooks/prepare-commit-msg` (or your repo’s `core.hooksPath` directory):

```sh
#!/bin/sh
# call the binary; pass through hook args
exec git-ai-commit hook prepare-commit-msg "$@"
```

Make it executable:

```bash
chmod +x .git/hooks/prepare-commit-msg
```

If you want repo-versioned hooks, use:

```bash
git config core.hooksPath .githooks
```

…and commit `.githooks/prepare-commit-msg`.

---

## 3) Behavior rules (important so you don’t annoy users)
In `prepare-commit-msg`, you typically **skip** when:
- source is `merge` (merge commit messages are auto-generated)
- source is `squash` (Git is constructing a squash message)
- the commit message file already has a non-comment, non-empty message (user provided `-m`, or a template exists)

Also, only use **staged diff**:
- `git diff --cached` (a.k.a. `--staged`)

---

## 4) Staged diff + prompt
Recommended diff command:

```bash
git diff --cached --no-color --no-ext-diff
```

(Optionally add `--minimal` or a size cap. If diff is huge, either truncate or summarize file list.)

Prompt example (keep it deterministic and short):

- System: “You write concise Git commit messages.”
- User: “Given this diff, write a single-line commit subject in imperative mood (max 72 chars). Then a blank line, then 3–7 bullet points.”

---

## 5) LLM call: simplest is “OpenAI-compatible” JSON
If you control the endpoint, easiest is to implement an **OpenAI Chat Completions–compatible** client:
- POST `${endpoint}`
- JSON with `model`, `messages`, maybe `temperature`

Return: `choices[0].message.content`.

If your endpoint differs, wrap it behind your own small adapter, but the OpenAI-compatible shape is a common lowest-friction option.

---

## 6) Writing the commit message file
Git passes you the message file path. You overwrite it with your suggestion, but usually preserve comments Git may add (like instructions) or write above them.

A common simple approach:
- Read existing file
- If it already contains a real message → do nothing
- Else write your generated message + two newlines + keep existing comment block (optional)

---

## 7) Minimal Go CLI structure (outline)
Suggested subcommands:

- `git-ai-commit hook prepare-commit-msg <msgfile> [source] [sha]`

Key pieces you’ll implement:

- `readConfig()` via `git config --get`
- `getStagedDiff()` via `git diff --cached ...`
- `callLLM(endpoint, model, apiKey, prompt)`
- `prefillMsgFile(msgfile, text)` with “don’t overwrite non-empty”

Pseudo-flow:

```go
func runPrepareCommitMsg(args []string) error {
    msgFile := args[0]
    source := "" ; if len(args) > 1 { source = args[1] }

    if source == "merge" || source == "squash" || source == "commit" {
        return nil // (tune this to your preference)
    }

    if commitMsgAlreadyHasContent(msgFile) {
        return nil
    }

    diff := gitDiffCached()
    if len(diff) == 0 { return nil }

    cfg := readGitConfig()
    prompt := buildPrompt(diff)

    msg := callLLM(cfg, prompt)
    msg = sanitize(msg) // trim, ensure newline ending, etc.

    writePrefill(msgFile, msg)
    return nil
}
```

---

## 8) One more practical tip: avoid blocking the commit
Even though you *want* to prefill, network can fail. Good default behavior in hook mode:
- If LLM fails/timeouts: **leave message file unchanged** and exit 0 (don’t block commit).

You can optionally `git config ai-commit.failHard true` later.

---

If you want, I can provide a concrete Go implementation (single file or small package) that:
- reads `ai-commit.*` keys via `git config`
- fetches staged diff
- calls an OpenAI-compatible endpoint
- prefills the commit message file safely (without overwriting user-provided messages or merge messages).

--- message ---
role: user
---
provide Go implementation as a single file

--- message ---
role: assistant
---
```go
// git-ai-commit: Prefill Git commit messages using an LLM (OpenAI-compatible API)
// Usage (hook):
//   git-ai-commit hook prepare-commit-msg <commit-msg-file> [<source> [<sha>]]
//
// Git config keys (suggested):
//   ai-commit.endpoint        (e.g. https://api.openai.com/v1/chat/completions)
//   ai-commit.model           (e.g. gpt-4o-mini)
//   ai-commit.apiKey          (your API key)
//   ai-commit.temperature     (optional, float; default 0.2)
//   ai-commit.maxDiffBytes    (optional, int; default 200000)
//   ai-commit.timeoutSeconds  (optional, int; default 30)
//
// Hook example (.git/hooks/prepare-commit-msg):
//   #!/bin/sh
//   exec git-ai-commit hook prepare-commit-msg "$@"
package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"net/http"
	"os"
	"os/exec"
	"strconv"
	"strings"
	"time"
)

type config struct {
	Endpoint       string
	Model          string
	APIKey         string
	Temperature    float64
	MaxDiffBytes   int
	TimeoutSeconds int
}

func main() {
	if len(os.Args) < 2 {
		printUsageAndExit(2)
	}

	switch os.Args[1] {
	case "hook":
		if len(os.Args) < 3 {
			printUsageAndExit(2)
		}
		if os.Args[2] != "prepare-commit-msg" {
			fatalf(2, "unsupported hook: %s", os.Args[2])
		}
		if err := runPrepareCommitMsg(os.Args[3:]); err != nil {
			// In hook mode, default to non-blocking behavior:
			// do not prevent commits if LLM/network/config fails.
			// Print to stderr for visibility, then exit 0.
			fmt.Fprintf(os.Stderr, "git-ai-commit: %v\n", err)
			os.Exit(0)
		}
		os.Exit(0)

	case "--help", "-h", "help":
		printUsageAndExit(0)

	default:
		fatalf(2, "unknown command: %s\n(try: git-ai-commit hook prepare-commit-msg ...)", os.Args[1])
	}
}

func printUsageAndExit(code int) {
	out := os.Stdout
	if code != 0 {
		out = os.Stderr
	}
	fmt.Fprintln(out, `git-ai-commit

Usage:
  git-ai-commit hook prepare-commit-msg <commit-msg-file> [<source> [<sha>]]

This is intended to be called from the Git prepare-commit-msg hook to prefill
the commit message editor with an LLM-generated message based on staged diff.`)
	os.Exit(code)
}

func runPrepareCommitMsg(args []string) error {
	if len(args) < 1 {
		return errors.New("prepare-commit-msg requires <commit-msg-file>")
	}
	msgFile := args[0]
	source := ""
	if len(args) >= 2 {
		source = args[1]
	}

	// Common skip cases:
	// - merge/squash: Git is constructing special commit messages.
	if source == "merge" || source == "squash" {
		return nil
	}

	// If the message file already has meaningful content (e.g. -m, template already filled),
	// do nothing.
	existing, err := os.ReadFile(msgFile)
	if err != nil {
		return fmt.Errorf("read commit message file: %w", err)
	}
	if hasNonCommentContent(string(existing)) {
		return nil
	}

	cfg, err := readConfig()
	if err != nil {
		return err
	}

	diff, err := getStagedDiff(cfg.MaxDiffBytes)
	if err != nil {
		return err
	}
	if strings.TrimSpace(diff) == "" {
		return nil
	}

	prompt := buildPrompt(diff)

	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(cfg.TimeoutSeconds)*time.Second)
	defer cancel()

	msg, err := callChatCompletions(ctx, cfg, prompt)
	if err != nil {
		return err
	}
	msg = sanitizeCommitMessage(msg)
	if msg == "" {
		return errors.New("LLM returned empty commit message")
	}

	// Preserve any existing content (likely Git comments/instructions).
	// Since we've verified there's no meaningful content, we can safely place our message on top.
	newBody := msg
	if !strings.HasSuffix(newBody, "\n") {
		newBody += "\n"
	}
	// Ensure one blank line before any existing comment block (if present).
	if strings.TrimSpace(string(existing)) != "" {
		if !strings.HasSuffix(newBody, "\n\n") {
			newBody += "\n"
		}
		newBody += string(existing)
	}

	if err := os.WriteFile(msgFile, []byte(newBody), 0o644); err != nil {
		return fmt.Errorf("write commit message file: %w", err)
	}
	return nil
}

func readConfig() (config, error) {
	// Reasonable defaults.
	cfg := config{
		Endpoint:       "https://api.openai.com/v1/chat/completions",
		Model:          "",
		APIKey:         "",
		Temperature:    0.2,
		MaxDiffBytes:   200_000,
		TimeoutSeconds: 30,
	}

	if v, ok := gitConfigGet("ai-commit.endpoint"); ok && strings.TrimSpace(v) != "" {
		cfg.Endpoint = strings.TrimSpace(v)
	}
	if v, ok := gitConfigGet("ai-commit.model"); ok {
		cfg.Model = strings.TrimSpace(v)
	}
	if v, ok := gitConfigGet("ai-commit.apiKey"); ok {
		cfg.APIKey = strings.TrimSpace(v)
	}

	if v, ok := gitConfigGet("ai-commit.temperature"); ok {
		if f, err := strconv.ParseFloat(strings.TrimSpace(v), 64); err == nil && !math.IsNaN(f) && !math.IsInf(f, 0) {
			cfg.Temperature = f
		}
	}
	if v, ok := gitConfigGet("ai-commit.maxDiffBytes"); ok {
		if n, err := strconv.Atoi(strings.TrimSpace(v)); err == nil && n > 0 {
			cfg.MaxDiffBytes = n
		}
	}
	if v, ok := gitConfigGet("ai-commit.timeoutSeconds"); ok {
		if n, err := strconv.Atoi(strings.TrimSpace(v)); err == nil && n > 0 {
			cfg.TimeoutSeconds = n
		}
	}

	if cfg.Model == "" {
		return cfg, errors.New("missing git config: ai-commit.model")
	}
	if cfg.APIKey == "" {
		return cfg, errors.New("missing git config: ai-commit.apiKey")
	}
	if cfg.Endpoint == "" {
		return cfg, errors.New("missing git config: ai-commit.endpoint")
	}

	return cfg, nil
}

func gitConfigGet(key string) (string, bool) {
	// Uses the effective config (system + global + local), which is usually what you want.
	// If the key is unset, git exits non-zero; we treat that as "not found".
	cmd := exec.Command("git", "config", "--get", key)
	var out bytes.Buffer
	cmd.Stdout = &out
	cmd.Stderr = io.Discard
	if err := cmd.Run(); err != nil {
		return "", false
	}
	return strings.TrimRight(out.String(), "\n"), true
}

func getStagedDiff(maxBytes int) (string, error) {
	// Staged diff only, and disable color/ext diff to keep prompts clean and deterministic.
	cmd := exec.Command("git", "diff", "--cached", "--no-color", "--no-ext-diff")
	var out bytes.Buffer
	var errBuf bytes.Buffer
	cmd.Stdout = &out
	cmd.Stderr = &errBuf
	if err := cmd.Run(); err != nil {
		return "", fmt.Errorf("git diff --cached failed: %v: %s", err, strings.TrimSpace(errBuf.String()))
	}

	b := out.Bytes()
	if maxBytes > 0 && len(b) > maxBytes {
		// Truncate safely. Add a marker so the model knows it’s incomplete.
		trunc := b[:maxBytes]
		return string(trunc) + "\n\n[diff truncated]\n", nil
	}
	return string(b), nil
}

func buildPrompt(diff string) string {
	// Keep prompt simple and instruction-focused.
	return strings.TrimSpace(fmt.Sprintf(`
You are an expert software engineer. Write a Git commit message for the following staged diff.

Requirements:
- Output plain text only.
- First line: a concise subject in imperative mood, max 72 characters.
- Then a blank line.
- Then 3–7 bullet points ("- ") summarizing key changes.
- Mention user-visible behavior changes and important refactors.
- Do not include code fences.

Staged diff:
%s
`, diff))
}

type chatCompletionsRequest struct {
	Model       string    `json:"model"`
	Messages    []message `json:"messages"`
	Temperature float64   `json:"temperature,omitempty"`
}

type message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type chatCompletionsResponse struct {
	Choices []struct {
		Message message `json:"message"`
	} `json:"choices"`
	Error *struct {
		Message string `json:"message"`
		Type    string `json:"type"`
	} `json:"error,omitempty"`
}

func callChatCompletions(ctx context.Context, cfg config, prompt string) (string, error) {
	reqBody := chatCompletionsRequest{
		Model: cfg.Model,
		Messages: []message{
			{Role: "system", Content: "You write concise, high-signal Git commit messages."},
			{Role: "user", Content: prompt},
		},
		Temperature: cfg.Temperature,
	}

	b, err := json.Marshal(reqBody)
	if err != nil {
		return "", fmt.Errorf("marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", cfg.Endpoint, bytes.NewReader(b))
	if err != nil {
		return "", fmt.Errorf("new request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+cfg.APIKey)

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("LLM request failed: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(io.LimitReader(resp.Body, 4<<20)) // cap 4MB
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		// Try to parse error shape; fall back to raw body.
		var parsed chatCompletionsResponse
		if json.Unmarshal(body, &parsed) == nil && parsed.Error != nil && parsed.Error.Message != "" {
			return "", fmt.Errorf("LLM HTTP %d: %s", resp.StatusCode, parsed.Error.Message)
		}
		return "", fmt.Errorf("LLM HTTP %d: %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}

	var parsed chatCompletionsResponse
	if err := json.Unmarshal(body, &parsed); err != nil {
		return "", fmt.Errorf("parse response: %w (body: %s)", err, strings.TrimSpace(string(body)))
	}
	if parsed.Error != nil && parsed.Error.Message != "" {
		return "", fmt.Errorf("LLM error: %s", parsed.Error.Message)
	}
	if len(parsed.Choices) == 0 {
		return "", errors.New("LLM response missing choices")
	}

	return parsed.Choices[0].Message.Content, nil
}

func sanitizeCommitMessage(s string) string {
	s = strings.ReplaceAll(s, "\r\n", "\n")
	s = strings.TrimSpace(s)

	// Some models might return surrounding quotes; strip common cases.
	s = strings.TrimPrefix(s, "```")
	s = strings.TrimSuffix(s, "```")
	s = strings.TrimSpace(s)

	// Ensure it ends with a newline (Git is fine either way, but this is tidy).
	if s != "" && !strings.HasSuffix(s, "\n") {
		s += "\n"
	}
	return s
}

func hasNonCommentContent(commitMsg string) bool {
	commitMsg = strings.ReplaceAll(commitMsg, "\r\n", "\n")
	for _, line := range strings.Split(commitMsg, "\n") {
		trim := strings.TrimSpace(line)
		if trim == "" {
			continue
		}
		if strings.HasPrefix(trim, "#") {
			continue
		}
		return true
	}
	return false
}

func fatalf(code int, format string, args ...any) {
	fmt.Fprintf(os.Stderr, "git-ai-commit: "+format+"\n", args...)
	os.Exit(code)
}
```

To wire it up quickly:

1) Build/install `git-ai-commit` somewhere on your `PATH` (so the hook can execute it).

2) Configure:
```bash
git config --global ai-commit.endpoint "https://api.openai.com/v1/chat/completions"
git config --global ai-commit.model "gpt-4o-mini"
git config --global ai-commit.apiKey "YOUR_KEY"
```

3) Add hook `.git/hooks/prepare-commit-msg`:
```sh
#!/bin/sh
exec git-ai-commit hook prepare-commit-msg "$@"
```
and `chmod +x .git/hooks/prepare-commit-msg`.

If you tell me which provider you’re using (OpenAI/Anthropic/local OpenAI-compatible), I can adjust the request/response parsing to match precisely.