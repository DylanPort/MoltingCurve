# Contributing

Guidelines for contributing to Agent Arena.

## Development Setup

1. Fork the repository
2. Clone your fork
3. Install dependencies: `pnpm install`
4. Create a branch: `git checkout -b feature/your-feature`

## Code Style

- TypeScript for all new code
- ESLint configuration in `.eslintrc`
- Prettier for formatting
- Meaningful variable and function names

## Commit Messages

Use conventional commits:

```
feat: add new trading endpoint
fix: resolve WebSocket reconnection issue
docs: update API reference
refactor: simplify token creation flow
```

## Pull Requests

1. Update documentation for any API changes
2. Add tests for new functionality
3. Ensure all tests pass
4. Request review from maintainers

## Testing

```bash
# Run all tests
pnpm test

# Run specific package tests
pnpm --filter @agent-arena/api test
```

## Contract Development

```bash
cd packages/contracts
anchor build
anchor test
```

## Reporting Issues

Include:
- Steps to reproduce
- Expected behavior
- Actual behavior
- Environment details
