import { Copy, ClipboardPaste, Palette, PaintBucket } from "lucide-react";
import type { Data } from "../model";
import { phasePalette } from "../model";
import { monthLabel } from "../format";
import type { useProjectMenus } from "./useProjectMenus";
type Props = {
  menus: ReturnType<typeof useProjectMenus>;
  data: Data | null;
  isAdmin: boolean;
  saving: boolean;
};
export default function ProjectContextMenus({
  menus,
  data,
  isAdmin,
  saving,
}: Props) {
  const {
    menuRef,
    phaseMenu,
    setPhaseMenu,
    milestoneMenu,
    setMilestoneMenu,
    copiedPhase,
    copiedPhaseColor,
    copiedPhaseBundle,
    copyPhase,
    copyPhaseColor,
    copyPhaseBundle,
    pastePhase,
    pastePhaseColor,
    pastePhaseBundle,
    copyMilestoneColor,
    pasteMilestoneColor,
    canPastePhase,
    copiedRowCounts,
  } = menus;
  return (
    <>
      <>
        {phaseMenu && (
          <>
            <div
              className="phase-menu-backdrop"
              aria-hidden="true"
              onClick={() => setPhaseMenu(null)}
              onContextMenu={(e) => {
                e.preventDefault();
                setPhaseMenu(null);
              }}
            />
            <div
              className="phase-menu"
              role="menu"
              aria-label="Aşama metni ve renk işlemleri"
              tabIndex={-1}
              ref={menuRef}
              style={{ left: phaseMenu.x, top: phaseMenu.y }}
            >
              <div className="phase-menu-title">
                {phaseMenu.projectIds.length ? (
                  phaseMenu.projectIds.length + " proje satırı · Tüm aylar"
                ) : (
                  <>
                    {
                      data?.projects.find((p) => p.id === phaseMenu.projectId)
                        ?.name
                    }{" "}
                    · {monthLabel(phaseMenu.month)}
                  </>
                )}
              </div>
              <button
                type="button"
                role="menuitem"
                disabled={
                  !phaseMenu.projectIds.length &&
                  !data?.projects.find((p) => p.id === phaseMenu.projectId)
                    ?.phases[phaseMenu.month]
                }
                onClick={copyPhase}
              >
                <Copy size={15} />
                Metni Kopyala
              </button>
              {isAdmin && (
                <button
                  type="button"
                  role="menuitem"
                  disabled={!canPastePhase("text") || saving}
                  onClick={pastePhase}
                >
                  <ClipboardPaste size={15} />
                  {copiedRowCounts.text
                    ? "Satırları Yapıştır (Metin)"
                    : "Metni Yapıştır"}
                </button>
              )}
              <div className="phase-menu-divider" role="separator" />
              <button type="button" role="menuitem" onClick={copyPhaseColor}>
                <Palette size={15} />
                Rengi Kopyala
              </button>
              {isAdmin && (
                <button
                  type="button"
                  role="menuitem"
                  disabled={!canPastePhase("color") || saving}
                  onClick={pastePhaseColor}
                >
                  <PaintBucket size={15} />
                  {copiedRowCounts.color
                    ? "Satırları Yapıştır (Renk)"
                    : "Rengi Yapıştır"}
                  {copiedPhaseColor && (
                    <span
                      className="phase-color-swatch"
                      style={{
                        background: phasePalette.find(
                          (c) => c.id === copiedPhaseColor,
                        )?.bg,
                        borderColor: phasePalette.find(
                          (c) => c.id === copiedPhaseColor,
                        )?.border,
                      }}
                    />
                  )}
                </button>
              )}
              <div className="phase-menu-divider" role="separator" />
              <button type="button" role="menuitem" onClick={copyPhaseBundle}>
                <Copy size={15} />
                Metin ve Rengi Kopyala
              </button>
              {isAdmin && (
                <button
                  type="button"
                  role="menuitem"
                  disabled={!canPastePhase("bundle") || saving}
                  onClick={pastePhaseBundle}
                >
                  <ClipboardPaste size={15} />
                  {copiedRowCounts.bundle
                    ? "Satırları Yapıştır (Metin + Renk)"
                    : "Metin ve Rengi Yapıştır"}
                  {copiedPhaseBundle && (
                    <span
                      className="phase-color-swatch"
                      style={{
                        background: phasePalette.find(
                          (c) => c.id === copiedPhaseBundle.color,
                        )?.bg,
                        borderColor: phasePalette.find(
                          (c) => c.id === copiedPhaseBundle.color,
                        )?.border,
                      }}
                    />
                  )}
                </button>
              )}
              {(phaseMenu.projectIds.length > 0 ||
                Object.values(copiedRowCounts).some(Boolean)) && (
                <p className="phase-row-copy-note">
                  Aylar aynı takvim aylarına yapıştırılır. Tek kaynak satırı
                  birden fazla projeye uygulanabilir.
                </p>
              )}
            </div>
          </>
        )}
      </>
      <>
        {milestoneMenu && (
          <>
            <div
              className="phase-menu-backdrop"
              aria-hidden="true"
              onClick={() => setMilestoneMenu(null)}
              onContextMenu={(e) => {
                e.preventDefault();
                setMilestoneMenu(null);
              }}
            />
            <div
              className="phase-menu"
              role="menu"
              aria-label="Kilometre taşı renk işlemleri"
              tabIndex={-1}
              ref={menuRef}
              style={{ left: milestoneMenu.x, top: milestoneMenu.y }}
            >
              <div className="phase-menu-title">
                {
                  data?.projects
                    .find((p) => p.id === milestoneMenu.projectId)
                    ?.milestones?.find(
                      (m) => m.id === milestoneMenu.milestoneId,
                    )?.name
                }
              </div>
              <button
                type="button"
                role="menuitem"
                onClick={copyMilestoneColor}
              >
                <Palette size={15} />
                Rengi Kopyala
              </button>
              {isAdmin && (
                <button
                  type="button"
                  role="menuitem"
                  disabled={copiedPhaseColor === null || saving}
                  onClick={pasteMilestoneColor}
                >
                  <PaintBucket size={15} />
                  Rengi Yapıştır
                  {copiedPhaseColor && (
                    <span
                      className="phase-color-swatch"
                      style={{
                        background: phasePalette.find(
                          (c) => c.id === copiedPhaseColor,
                        )?.bg,
                        borderColor: phasePalette.find(
                          (c) => c.id === copiedPhaseColor,
                        )?.border,
                      }}
                    />
                  )}
                </button>
              )}
            </div>
          </>
        )}
      </>
    </>
  );
}
