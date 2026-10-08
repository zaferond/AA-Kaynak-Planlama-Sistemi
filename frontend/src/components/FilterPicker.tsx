import { useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { fold } from "../model";
export function Picker({
  label,
  value,
  onChange,
  items,
  single = false,
  empty = "Tümü",
}: {
  label: string;
  value: string[];
  onChange: (v: string[]) => void;
  items: { id: string; name: string }[];
  single?: boolean;
  empty?: string;
}) {
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState(""),
    [modal, setModal] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const closePicker = () => {
    setOpen(false);
    setQuery("");
  };
  const shown = items.filter((i) => fold(i.name).includes(fold(query)));
  const selected = items.filter((i) => value.includes(i.id));
  return (
    <div
      ref={pickerRef}
      className={"pick" + (value.length ? " filter-active" : "")}
    >
      <span>{label}</span>
      <Popover
        open={open}
        modal={modal}
        onOpenChange={(v) => {
          // A dialog locks scrolling outside itself. Its portalled picker needs
          // its own modal scroll boundary so wheel/touch scrolling stays usable.
          if (v) setModal(!!pickerRef.current?.closest('[role="dialog"]'));
          setOpen(v);
          if (!v) setQuery("");
        }}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            className="pickerbutton"
            aria-label={label}
            title={selected.map((i) => i.name).join(", ")}
          >
            <span>
              {value.length
                ? selected.length === 1
                  ? selected[0].name
                  : value.length + " seçim"
                : empty}
            </span>
            <ChevronDown size={15} />
          </button>
        </PopoverTrigger>
        <PopoverContent
          className={"pickerpanel" + (single ? " pickerpanel-single" : "")}
          align="start"
          side="bottom"
          collisionPadding={12}
        >
          <div className="pickersearch">
            <Search size={16} />
            <input
              autoFocus
              aria-label={label + " içinde ara"}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Yazarak ara…"
            />
          </div>
          {!single && (
            <div className="pickeractions">
              <button
                onClick={() =>
                  onChange([...new Set([...value, ...shown.map((x) => x.id)])])
                }
              >
                Tümünü Seç
              </button>
              <button onClick={() => onChange([])}>Seçimleri Kaldır</button>
            </div>
          )}
          <div className="pickeroptions">
            {single && (
              <button
                className="option"
                onClick={() => {
                  onChange([]);
                  closePicker();
                }}
              >
                {empty}
              </button>
            )}
            {shown.map((i) =>
              single ? (
                <button
                  key={i.id}
                  className={"option " + (value.includes(i.id) ? "chosen" : "")}
                  onClick={() => {
                    onChange([i.id]);
                    closePicker();
                  }}
                >
                  {i.name}
                  {value.includes(i.id) && <Check size={15} />}
                </button>
              ) : (
                <label key={i.id} className="option">
                  <input
                    type="checkbox"
                    checked={value.includes(i.id)}
                    onChange={(e) =>
                      onChange(
                        e.target.checked
                          ? [...value, i.id]
                          : value.filter((v) => v !== i.id),
                      )
                    }
                  />
                  {i.name}
                </label>
              ),
            )}
            {!shown.length && <p>Sonuç bulunamadı.</p>}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
export function Single({
  label,
  value,
  onChange,
  items,
  empty = "Seçin",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  items: { id: string; name: string }[];
  empty?: string;
}) {
  return (
    <Picker
      label={label}
      value={value ? [value] : []}
      onChange={(v) => onChange(v[0] || "")}
      items={items}
      single
      empty={empty}
    />
  );
}
