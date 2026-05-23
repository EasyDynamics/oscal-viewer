export interface PartyLike {
  uuid: string;
  type?: string;
  name?: string;
  "short-name"?: string;
  links?: { href: string; rel?: string; text?: string }[];
}

export interface RoleLike {
  id: string;
  title?: string;
}

export interface ResponsiblePartyLike {
  "role-id": string;
  "party-uuids"?: string[];
}

export function partyDisplayName(partyOrUuid: PartyLike | string | undefined): string {
  if (!partyOrUuid) return "Unknown party";
  if (typeof partyOrUuid === "string") return partyOrUuid;
  return partyOrUuid.name || partyOrUuid["short-name"] || partyOrUuid.uuid;
}
