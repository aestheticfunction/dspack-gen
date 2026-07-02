/**
 * Vendored copy of dspack.surface.v0_1.schema.json (dspack repo, schema/).
 * Gate S1's ground truth. Re-vendor when the surface schema version bumps;
 * the const below is asserted against surface documents at lint time.
 */
export const SURFACE_SCHEMA_VERSION = "0.1";

export const surfaceSchemaV0_1 = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://github.com/aestheticfunction/dspack/blob/main/schema/dspack.surface.v0_1.schema.json",
  "title": "dspack surface v0.1",
  "description": "Schema for a dspack surface document — a protocol-neutral, nested component tree expressed in a dspack contract's vocabulary (component IDs, sub-component IDs, props, slots, text leaves) plus a declared generation intent. A surface is the pipeline's intermediate representation: never rendered, never transported, always compiled to a protocol by an emitter. This generic schema is the portable validation floor (gate S1); checking the tree against a specific contract's vocabulary is a separate gate (S2), and governance rules are a third (S3). The schema answers whether the object can exist; the linter answers whether it is correct; a renderer answers whether its compiled form can render. These layers must never collapse.",
  "type": "object",
  "required": [
    "dspackSurface",
    "system",
    "intent",
    "root"
  ],
  "properties": {
    "dspackSurface": {
      "type": "string",
      "const": "0.1",
      "description": "Surface format version. MUST be \"0.1\" for documents conforming to this version."
    },
    "system": {
      "type": "string",
      "minLength": 1,
      "description": "Name of the design system contract this surface is expressed against (the contract's top-level name)."
    },
    "intent": {
      "type": "string",
      "description": "The declared generation intent (an intent ID registered in the bound contract). Declared by the caller, carried in the artifact, and used by the linter to activate intent-scoped rules."
    },
    "root": {
      "$ref": "#/$defs/node",
      "description": "The root component node of the surface tree."
    }
  },
  "additionalProperties": false,
  "$defs": {
    "node": {
      "type": "object",
      "description": "A component instance in the surface tree. 'component' is a component ID or sub-component ID from the bound contract's vocabulary.",
      "required": [
        "component"
      ],
      "properties": {
        "component": {
          "type": "string",
          "description": "Component ID or sub-component ID from the bound contract."
        },
        "id": {
          "type": "string",
          "description": "Optional stable identifier for this node, used in lint finding locations and emitted artifacts."
        },
        "props": {
          "type": "object",
          "description": "Prop values for this node. Prop names and enum values are validated against the bound contract (gate S2), not by this schema."
        },
        "text": {
          "type": "string",
          "description": "Text content for leaf nodes (components or sub-components that accept text children)."
        },
        "children": {
          "type": "array",
          "description": "Ordered child nodes.",
          "items": {
            "$ref": "#/$defs/node"
          }
        },
        "slots": {
          "type": "object",
          "description": "Named slot contents, keyed by slot name declared on the parent's sub-components in the bound contract.",
          "additionalProperties": {
            "type": "array",
            "items": {
              "$ref": "#/$defs/node"
            }
          }
        }
      },
      "additionalProperties": false
    }
  }
} as const;
