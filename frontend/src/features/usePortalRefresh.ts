import { useEffect, useRef, type RefObject } from "react";
import { checkUpdates } from "../storage";

// Background reads wait until local editors, risk drafts and focused cells are idle.
export function usePortalRefresh({
  load,
  editing,
  saving,
  riskEditing,
  riskEditingRef,
}: {
  load: () => Promise<void>;
  editing: boolean;
  saving: boolean;
  riskEditing: boolean;
  riskEditingRef: RefObject<boolean>;
}) {
  const pendingExternal = useRef(false);
  useEffect(() => {
    load();
  }, []);
  useEffect(() => {
    const refresh = () => {
      if (
        pendingExternal.current &&
        !editing &&
        !saving &&
        !riskEditingRef.current &&
        !document.querySelector("input:focus,textarea:focus,select:focus")
      ) {
        pendingExternal.current = false;
        void load();
      }
    };
    const changed = (e: StorageEvent) => {
      if (e.key === "kaynak-planlama-offline-v1") {
        pendingExternal.current = true;
        refresh();
      }
    };
    const afterBlur = () => {
      setTimeout(refresh, 0);
    };
    const timer = setInterval(() => {
      if (document.visibilityState === "visible")
        void checkUpdates()
          .then((changed) => {
            if (changed) {
              pendingExternal.current = true;
              refresh();
            }
          })
          .catch(() => {});
    }, 15000);
    window.addEventListener("storage", changed);
    document.addEventListener("focusout", afterBlur);
    refresh();
    return () => {
      clearInterval(timer);
      window.removeEventListener("storage", changed);
      document.removeEventListener("focusout", afterBlur);
    };
  }, [editing, saving, riskEditing]);
}
