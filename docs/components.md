# Frontend Components

## Conventions

Per [AGENTS.md §5](../AGENTS.md): standalone components only, `input()`/`output()` signals, `@if`/`@for`/`@switch` control flow, Tailwind for 95% of styling, no NgRx (signals + services).

## Component inventory

_Updated as new components are added. Group by feature module._

### App shell

_None yet beyond default Nx scaffold._

### Auth

_None yet._

### Trip discovery

_None yet._

### Trip detail

_None yet._

### Chat

_None yet._

### Board

_None yet._

### Profile

_None yet._

## Shared

### UI primitives

_None yet. When a primitive is extracted (button, modal, input, avatar), document here with its API and where it's used._

### Layout

_None yet._

## Routing

_To be filled in as routes are added. Each lazy-loaded feature gets one row._

| Path | Component | Guard | Module |
|---|---|---|---|
| _tbd_ | _tbd_ | _tbd_ | _tbd_ |

## State services

_To be filled in. Each global state service (`AuthStateService`, etc.) gets a row with its signals + update methods._

| Service | Signals exposed | Mutators | Persisted? |
|---|---|---|---|
| _tbd_ | _tbd_ | _tbd_ | _tbd_ |
