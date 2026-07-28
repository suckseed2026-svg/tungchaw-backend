# Architecture

The backend remains the security authority. Web and mobile clients may hide actions based on permissions, but every API request must be authorized by NestJS.

Both clients send a bearer access token and `X-Business-Id`. Future branch-scoped APIs should also validate branch assignments server-side.

`packages/shared` is intentionally platform-neutral: no browser, Node, React, or React Native dependencies. Add shared API DTOs and permission codes here as endpoints stabilize. Do not put UI components in this package because web and native rendering systems differ.

Future packages may include `api-client`, `validation`, `eslint-config`, and `tsconfig`.
