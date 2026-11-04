---
name: code-flow-mapper
description: Triggers when asked to explain how a component works, trace a data flow, or map out the architecture of a specific feature. It breaks down the execution path step-by-step and provides official documentation links for the active framework, catering to a deep, thorough learning style.
---

# Code Flow & Architecture Mapper

## Goal
To patiently and clearly explain the exact execution flow of a specific component or feature from the entry point down to the data fetching/database layer, while providing exact reference materials for whatever framework or language is being used.

## Instructions
When asked to explain a piece of code, trace its entire lifecycle using the following structure. Adapt the layers based on the detected framework (e.g., React/Refine vs. Django/Python vs. Java/Spring):

1. **The Entry Point**: Identify where this flow begins (e.g., a frontend route, a Django `urls.py` path, or a Java controller endpoint).
2. **The Logic/Component Layer**: Explain the primary purpose of the UI component, Django View, or Java Service.
3. **The Data Binding / Hook Layer**: Detail the specific hooks, ORM queries, or service methods being called. Explain *what* parameters or payloads are being passed.
4. **The Database / API Layer**: Map the logic down to how data is actually fetched, updated, or persisted (e.g., Refine Data Providers, Django Models/QuerySets, Java Repositories).
5. **Official Documentation Links**: Identify the core frameworks and libraries used in the explanation. Output a dedicated list of URLs pointing to the *official* documentation for every single hook, class, built-in function, or module mentioned.

## Constraints
- **Do Not** assume prior knowledge of complex architectural patterns.
- **Do Not** skip steps in the data flow.
- Use simple, chronological language (e.g., "First, the request hits...", "Next, the view triggers...").
- Provide short code snippets of the exact files in the repository to ground the explanation in reality.
- **Dynamic Docs**: Always link to the correct official documentation for the detected language/framework (e.g., `refine.dev` for Refine, `docs.djangoproject.com` for Django, `docs.oracle.com` for Java). For Refine, strictly enforce v5 links.
