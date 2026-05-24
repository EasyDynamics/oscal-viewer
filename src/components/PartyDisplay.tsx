import type { CSSProperties } from "react";
import { Building2, Link2, User, Users } from "lucide-react";
import { alpha, colors, fonts, radii } from "../theme/tokens";
import { partyDisplayName, type PartyLike, type ResponsiblePartyLike, type RoleLike } from "../utils/partyDisplay";

function isOrganization(type?: string): boolean {
  return (type ?? "").toLowerCase() === "organization";
}

function partyColor(type?: string): string {
  return isOrganization(type) ? colors.cobalt : colors.mint;
}

export function PartyIcon({ type, size = 16, style }: { type?: string; size?: number; style?: CSSProperties }) {
  return isOrganization(type) ? <Building2 size={size} style={style} /> : <User size={size} style={style} />;
}

export function PartyChip({ party, fallbackUuid }: { party?: PartyLike; fallbackUuid?: string }) {
  const label = partyDisplayName(party ?? fallbackUuid);
  const color = partyColor(party?.type);
  return (
    <span
      title={party?.uuid ?? fallbackUuid}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 12,
        padding: "4px 10px",
        borderRadius: radii.pill,
        backgroundColor: alpha(color, 9),
        color,
        border: `1px solid ${alpha(color, 22)}`,
        fontWeight: 650,
      }}
    >
      <PartyIcon type={party?.type} size={13} style={{ flexShrink: 0 }} />
      <span>{label}</span>
    </span>
  );
}

export function PartyCard({ party }: { party: PartyLike }) {
  const color = partyColor(party.type);
  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        padding: "12px 14px",
        borderRadius: radii.md,
        backgroundColor: alpha(color, 6),
        border: `1px solid ${alpha(color, 20)}`,
        minWidth: 0,
      }}
    >
      <span
        style={{
          width: 38,
          height: 38,
          borderRadius: radii.md,
          backgroundColor: alpha(color, 12),
          color,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <PartyIcon type={party.type} size={20} />
      </span>
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: colors.navy, overflowWrap: "anywhere" }}>
            {partyDisplayName(party)}
          </span>
        </span>
        {party["short-name"] && party["short-name"] !== party.name && (
          <span style={{ display: "block", fontSize: 12, color: colors.gray, marginTop: 3 }}>
            Short name: {party["short-name"]}
          </span>
        )}
        {(party.links ?? []).length > 0 && (
          <span style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
            {(party.links ?? []).map((link, index) => (
              <a
                key={`${link.href}-${index}`}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: 11,
                  color: colors.brightBlue,
                  textDecoration: "none",
                  fontFamily: fonts.mono,
                  overflowWrap: "anywhere",
                }}
              >
                <Link2 size={11} />
                {link.text ?? link.rel ?? link.href}
              </a>
            ))}
          </span>
        )}
      </span>
    </div>
  );
}

export function PartyCardGrid({ parties }: { parties: PartyLike[] }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 10 }}>
      {parties.map((party) => <PartyCard key={party.uuid} party={party} />)}
    </div>
  );
}

export function ResponsiblePartiesList({
  responsibleParties,
  parties,
  roles = [],
}: {
  responsibleParties: ResponsiblePartyLike[];
  parties: PartyLike[];
  roles?: RoleLike[];
}) {
  const partyByUuid = new Map(parties.map((party) => [party.uuid, party]));
  const roleById = new Map(roles.map((role) => [role.id, role.title || role.id]));

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {responsibleParties.map((responsibleParty, index) => {
        const roleName = roleById.get(responsibleParty["role-id"]) ?? responsibleParty["role-id"];
        const partyUuids = responsibleParty["party-uuids"] ?? [];
        return (
          <div
            key={`${responsibleParty["role-id"]}-${index}`}
            style={{
              padding: "10px 12px",
              borderRadius: radii.md,
              backgroundColor: colors.surfaceSubtle,
              border: `1px solid ${colors.paleGray}`,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: partyUuids.length ? 8 : 0 }}>
              <Users size={15} style={{ color: colors.cobalt, flexShrink: 0 }} />
              <span style={{ fontSize: 12, fontWeight: 800, color: colors.navy, textTransform: "uppercase", letterSpacing: 0.45 }}>
                {roleName}
              </span>
              {roleName !== responsibleParty["role-id"] && (
                <span style={{ fontSize: 11, color: colors.gray, fontFamily: fonts.mono }}>({responsibleParty["role-id"]})</span>
              )}
            </div>
            {partyUuids.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {partyUuids.map((uuid) => <PartyChip key={uuid} party={partyByUuid.get(uuid)} fallbackUuid={uuid} />)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
