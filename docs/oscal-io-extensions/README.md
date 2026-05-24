# OSCAL Viewer Props Preview README

This is a preview of the OSCAL properties that OSCAL Viewer treats as more than plain metadata.

OSCAL lets producers add `props` throughout a document. Most props are shown as ordinary metadata when the page has a place to display them. A smaller set is honored as **first-class UI information**: the viewer may use those props for labels, ordering, badges, icons, grouping, or other visual behavior.

This page is intentionally a working preview. The viewer already honors some CSRC OSCAL namespace props, and more first-class CSRC handling is expected over time. The viewer also defines a small number of OSCAL.io-specific props under the OSCAL.io namespace.

## Namespace summary

| Namespace | Purpose in this viewer |
|---|---|
| `http://csrc.nist.gov/ns/oscal` | Standard OSCAL namespace. Props in this namespace may be treated as first-class OSCAL semantics when the viewer knows how to render them. |
| `http://oscal.io/ns` | OSCAL.io viewer namespace. Props in this namespace are viewer-specific hints for display behavior that is not currently represented by a standard OSCAL prop. |
| Other namespaces | Usually displayed, if surfaced by the page, as ordinary metadata. They should not trigger OSCAL.io-specific UI behavior. |

## Producer guidance

- Use normal OSCAL fields first.
- Use the CSRC OSCAL namespace for standard OSCAL props that carry OSCAL semantics.
- Use the OSCAL.io namespace only for viewer-specific hints documented here.
- Do not put OSCAL.io viewer hints in the CSRC OSCAL namespace.
- Treat this README as a preview of current viewer behavior, not as a replacement for the OSCAL specification.

## CSRC OSCAL namespace props honored by the viewer

The viewer is starting to treat selected CSRC OSCAL props as first-class UI inputs.

### Control and group labels: `label`

The viewer uses `label` props to show human-friendly control and group labels when available.

Common location:

```text
catalog.groups[].props[]
catalog.groups[].controls[].props[]
```

Example:

```json
{
  "name": "label",
  "ns": "http://csrc.nist.gov/ns/oscal",
  "value": "AC-1"
}
```

Viewer behavior:

- Shows the label near control and group titles.
- Prefers a non-`zero-padded` label when both padded and non-padded labels are present.

### Catalog ordering: `sort-id`

The viewer uses `sort-id` values to keep controls and groups in catalog-defined order when building sorted control lists.

Common location:

```text
catalog.groups[].props[]
catalog.groups[].controls[].props[]
```

Example:

```json
{
  "name": "sort-id",
  "ns": "http://csrc.nist.gov/ns/oscal",
  "value": "ac-01"
}
```

Viewer behavior:

- Sorts controls and families by `sort-id` when a loaded catalog provides it.
- Falls back to numeric-aware text sorting when no `sort-id` is available.

### Withdrawn controls: `status=withdrawn`

The viewer recognizes withdrawn catalog controls when `status` is in the CSRC OSCAL namespace and its value is `withdrawn`.

Common location:

```text
catalog.groups[].controls[].props[]
```

Example:

```json
{
  "name": "status",
  "ns": "http://csrc.nist.gov/ns/oscal",
  "value": "withdrawn"
}
```

Viewer behavior:

- Counts withdrawn controls in catalog summary information.
- Marks withdrawn controls and enhancements in catalog/profile views.

### Component and inventory visuals: `asset-type`

The viewer uses `asset-type` to choose more specific icons and labels for SSP components and inventory items when the value matches a known asset type.

Common locations:

```text
system-security-plan.system-implementation.components[].props[]
system-security-plan.system-implementation.inventory-items[].props[]
```

Example:

```json
{
  "name": "asset-type",
  "ns": "http://csrc.nist.gov/ns/oscal",
  "value": "database"
}
```

Known first-class values currently include:

| Value | Viewer label/icon intent |
|---|---|
| `operating-system` | Operating system |
| `database` | Database |
| `web-server` | Web server |
| `dns-server` | DNS server |
| `email-server` | Email server |
| `directory-server` | Directory server |
| `pbx` | PBX |
| `firewall` | Firewall |
| `router` | Router |
| `switch` | Switch |
| `storage-array` | Storage array |
| `appliance` | Appliance |

Unknown values may still be displayed as metadata, but they do not receive specialized visuals.

### Component definition raised props

On component definitions, the viewer raises selected CSRC OSCAL props into prominent visual chips.

Common location:

```text
component-definition.components[].props[]
```

Currently raised names include:

| Prop name | Viewer label |
|---|---|
| `label` | Label |
| `baseline-configuration-name` | Baseline |
| `implementation-point` | Implementation Point |
| `allows-authenticated-scan` | Authenticated Scan |
| `virtual` | Virtual |
| `public` | Public |
| `asset-type` | Asset Type |
| `function` | Function |
| `model` | Model |

Example:

```json
{
  "name": "implementation-point",
  "ns": "http://csrc.nist.gov/ns/oscal",
  "value": "service-provider"
}
```

Viewer behavior:

- Shows known CSRC props as prominent chips with purpose-specific icons and labels.
- Uses specialized `asset-type` visuals when the value is known.

### Back-matter resource grouping: `definition-type`

The viewer uses `definition-type` to group back-matter resources when no OSCAL.io resource `type` hint is present.

Common location:

```text
back-matter.resources[].props[]
```

Example:

```json
{
  "name": "definition-type",
  "ns": "http://csrc.nist.gov/ns/oscal",
  "value": "azure-documentation"
}
```

Viewer behavior:

- Groups resources by `definition-type`.
- Gives known values, such as `azure-documentation`, a friendlier label and icon.
- Falls back to a generic resource group for unknown values.

## OSCAL.io namespace viewer hints

OSCAL.io props are viewer-specific display hints. They should use this namespace:

```text
http://oscal.io/ns
```

Use them only when the behavior is not already represented by standard OSCAL content or a CSRC OSCAL prop.

## Implemented requirement: `llm-generated`

Use `llm-generated` on component-definition implemented requirements to identify whether an implementation statement was generated by an LLM.

Location:

```text
component-definition.components[].control-implementations[].implemented-requirements[].props[]
```

Example:

```json
{
  "name": "llm-generated",
  "ns": "http://oscal.io/ns",
  "value": "yes"
}
```

Viewer behavior:

| Value | Behavior |
|---|---|
| `yes` | Displays an **LLM Generated** badge. |
| `no` | Does not display a badge. |
| Any other value | Ignored by the viewer. |

## Back-matter resource category: `type`

Use OSCAL.io `type` on back-matter resources to categorize references and attachments when there is no standard OSCAL prop that captures the viewer-specific category you need.

Location:

```text
back-matter.resources[].props[]
```

Example:

```json
{
  "name": "type",
  "ns": "http://oscal.io/ns",
  "value": "standards"
}
```

Known OSCAL.io values:

| Value | Viewer label | Icon |
|---|---|---|
| `standards` | Standards | Standard/check icon |
| `threat-intelligence` | Threat Intel | Target icon |

Viewer behavior:

- Groups resources by the known OSCAL.io `type` value.
- Gives OSCAL.io `type` precedence over `definition-type` for resource grouping.
- Ignores unknown OSCAL.io `type` values for special grouping.

## Embedded back-matter attachments

For embedded artifacts, put the payload on the back-matter resource as `base64`. Do not store attachment payloads in props.

If a back-matter resource has `base64` and no recognized OSCAL.io `type` or `definition-type`, the viewer groups it as **Embedded Attachments** and uses a paperclip icon.

Example:

```json
{
  "uuid": "11111111-1111-4111-8111-111111111111",
  "title": "Threat Intelligence Brief",
  "props": [
    {
      "name": "type",
      "ns": "http://oscal.io/ns",
      "value": "threat-intelligence"
    }
  ],
  "base64": {
    "filename": "threat-brief.pdf",
    "media-type": "application/pdf",
    "value": "JVBERi0xLjQKJ..."
  }
}
```

If a resource is both categorized and embedded, include both the category prop and the `base64` object.

## Current precedence notes

- Known OSCAL.io back-matter `type` values are used before `definition-type` for resource grouping.
- `definition-type` is used before the generic embedded-attachment fallback.
- CSRC `status=withdrawn` requires the CSRC OSCAL namespace to trigger withdrawn-control behavior.
- Some older or general display paths may still fall back to matching a prop by name even when `ns` is omitted. Producers should still include the correct namespace.

## Producer checklist

- Use OSCAL-native fields first.
- Use `ns: "http://csrc.nist.gov/ns/oscal"` for standard OSCAL props.
- Use `ns: "http://oscal.io/ns"` only for documented OSCAL.io viewer hints.
- Use exact lowercase names and values where documented.
- Keep large embedded payloads in resource-level `base64`, not in `props[].value`.
- Treat OSCAL.io hints as optional display metadata, not required OSCAL semantics.
- Update this README and the viewer code together when adding new first-class prop behavior.
