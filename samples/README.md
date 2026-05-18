# Sample OSCAL Files

Place OSCAL JSON documents here for local testing and development.

Supported models:
- **Catalog** — `catalog-*.json`
- **Profile** — `profile-*.json`
- **Component Definition** — `component-definition-*.json`
- **System Security Plan** — `ssp-*.json`
- **Assessment Plan** — `assessment-plan-*.json`
- **Assessment Results** — `assessment-results-*.json`
- **POA&M** — `poam-*.json`

## Leveraged / Provider SSPs

The SSP viewer supports uploading provider SSP files to resolve `inherited` and `satisfied` UUID cross-references. Place provider SSPs here alongside the consumer SSP for easy access during development. The viewer matches provider exports to leveraged authorizations and displays a controls-offered tree for each provider system.

## Loading via URL

Any viewer page accepts a `?url=` query parameter pointing to a raw JSON file. For example:

```
http://localhost:5173/ssp?url=https://raw.githubusercontent.com/.../ssp.json
```
