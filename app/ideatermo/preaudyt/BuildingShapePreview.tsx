import {
  HEATED_LEVEL_LABELS,
  getAvailableHeatedLevels,
  type BuildingStoreysValue,
  type HeatedLevelValue,
  type RoofTypeValue,
} from "@/lib/ideatermo/preauditFields";

type BuildingShapePreviewProps = {
  buildingStoreys: BuildingStoreysValue;
  roofType: RoofTypeValue;
  hasBasement: boolean;
  hasIntegratedGarage: boolean;
  heatedLevels: HeatedLevelValue[];
  onToggleLevel: (level: HeatedLevelValue) => void;
};

type LevelButtonProps = {
  level: HeatedLevelValue;
  heated: boolean;
  basement?: boolean;
  onToggle: (level: HeatedLevelValue) => void;
};

function LevelButton({
  level,
  heated,
  basement = false,
  onToggle,
}: LevelButtonProps) {
  const toneClass = basement
    ? heated
      ? "border-termo-700 bg-termo-300 text-termo-950 shadow-[inset_5px_0_0_#2864b6] hover:bg-termo-200 dark:border-termo-500 dark:bg-termo-900 dark:text-termo-50 dark:hover:bg-termo-800"
      : "border-slate-600 bg-slate-300 text-slate-900 hover:bg-slate-200 dark:border-slate-500 dark:bg-slate-700 dark:text-slate-50 dark:hover:bg-slate-600"
    : heated
      ? "border-termo-500 bg-termo-100 text-termo-950 shadow-[inset_5px_0_0_#418cef] dark:bg-termo-950/60 dark:text-termo-50"
      : "border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700";

  return (
    <button
      type="button"
      aria-pressed={heated}
      aria-label={`${HEATED_LEVEL_LABELS[level]}: ${
        heated ? "ogrzewane" : "nieogrzewane"
      }`}
      onClick={() => onToggle(level)}
      className={`group relative flex h-14 w-56 items-center justify-between overflow-hidden border-x border-t px-4 text-left transition last:border-b ${
        basement ? "border-dashed" : ""
      } ${toneClass}`}
    >
      <span>
        <span className="block text-sm font-black">
          {HEATED_LEVEL_LABELS[level]}
        </span>
        <span className="text-[10px] font-bold uppercase tracking-wide opacity-65">
          {heated ? "ogrzewane" : "nieogrzewane"}
        </span>
      </span>
      <span className="flex gap-2" aria-hidden="true">
        <span
          className={`h-5 w-4 rounded-sm border ${
            heated
              ? "border-termo-400 bg-white/80"
              : "border-slate-400 bg-white/60 dark:bg-slate-900"
          }`}
        />
        <span
          className={`h-5 w-4 rounded-sm border ${
            heated
              ? "border-termo-400 bg-white/80"
              : "border-slate-400 bg-white/60 dark:bg-slate-900"
          }`}
        />
      </span>
    </button>
  );
}

function PitchedRoof({
  withAttic,
  heated,
  onToggle,
}: {
  withAttic: boolean;
  heated: boolean;
  onToggle: (level: HeatedLevelValue) => void;
}) {
  const content = (
    <>
      <svg
        viewBox="0 0 256 92"
        className="absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        <polygon
          points="8,88 128,8 248,88"
          className={
            withAttic && heated
              ? "fill-termo-100 stroke-termo-500 dark:fill-termo-950/60"
              : "fill-slate-200 stroke-slate-500 dark:fill-slate-800 dark:stroke-slate-500"
          }
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <line
          x1="128"
          y1="14"
          x2="128"
          y2="88"
          className="stroke-slate-400/50"
          strokeDasharray="4 4"
        />
      </svg>
      <span className="relative z-10 mt-8 text-center">
        <span className="block text-sm font-black">
          {withAttic ? "Poddasze" : "Dach skośny"}
        </span>
        {withAttic && (
          <span className="text-[10px] font-bold uppercase tracking-wide opacity-65">
            {heated ? "ogrzewane" : "nieogrzewane"}
          </span>
        )}
      </span>
    </>
  );

  return withAttic ? (
    <button
      type="button"
      aria-pressed={heated}
      aria-label={`Poddasze: ${heated ? "ogrzewane" : "nieogrzewane"}`}
      onClick={() => onToggle("attic")}
      className={`relative flex h-24 w-56 items-center justify-center transition ${
        heated
          ? "text-termo-950 dark:text-termo-50"
          : "text-slate-700 dark:text-slate-200"
      }`}
    >
      {content}
    </button>
  ) : (
    <div className="relative flex h-24 w-56 items-center justify-center text-slate-700 dark:text-slate-200">
      {content}
    </div>
  );
}

function GroundLevelMarker({ hasGarage }: { hasGarage: boolean }) {
  return (
    <div aria-hidden="true" className="relative z-20 h-0 w-56">
      <div
        className={`absolute -left-3 -top-px border-t-[3px] border-amber-950 dark:border-amber-400 ${
          hasGarage ? "-right-[7.25rem]" : "-right-3"
        }`}
      >
        <span className="absolute left-3 -top-5 whitespace-nowrap rounded-t-md bg-amber-950 px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.16em] text-white dark:bg-amber-400 dark:text-slate-950">
          Poziom gruntu
        </span>
      </div>
    </div>
  );
}

function GarageButton({
  heated,
  hasBasement,
  onToggle,
}: {
  heated: boolean;
  hasBasement: boolean;
  onToggle: (level: HeatedLevelValue) => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={heated}
      aria-label={`Garaż: ${heated ? "ogrzewany" : "nieogrzewany"}`}
      onClick={() => onToggle("garage")}
      className={`relative z-10 -ml-px flex h-24 w-28 shrink-0 flex-col items-center justify-end rounded-tr-2xl border pb-2 text-left shadow-sm transition ${
        hasBasement ? "mb-14" : ""
      } ${
        heated
          ? "border-termo-500 bg-termo-100 text-termo-950 shadow-[inset_5px_0_0_#418cef] dark:bg-termo-950/60 dark:text-termo-50"
          : "border-slate-400 bg-slate-200 text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
      }`}
    >
      <span
        aria-hidden="true"
        className={`absolute left-3 right-3 top-3 h-12 rounded border ${
          heated
            ? "border-termo-400 bg-white/80"
            : "border-slate-400 bg-white/70 dark:bg-slate-900"
        }`}
      >
        <span className="absolute inset-x-0 top-1/3 border-t border-slate-300 dark:border-slate-700" />
        <span className="absolute inset-x-0 top-2/3 border-t border-slate-300 dark:border-slate-700" />
      </span>
      <span className="text-center">
        <span className="block text-xs font-black">Garaż</span>
        <span className="block text-[8px] font-bold uppercase tracking-wide opacity-65">
          {heated ? "ogrzewany" : "nieogrzewany"}
        </span>
      </span>
    </button>
  );
}

export default function BuildingShapePreview({
  buildingStoreys,
  roofType,
  hasBasement,
  hasIntegratedGarage,
  heatedLevels,
  onToggleLevel,
}: BuildingShapePreviewProps) {
  const availableLevels = getAvailableHeatedLevels({
    buildingStoreys,
    roofType,
    hasBasement,
    hasIntegratedGarage,
  });
  const heated = new Set(heatedLevels);
  const aboveGroundLevels = availableLevels
    .filter(
      (level) =>
        level.value !== "basement" &&
        level.value !== "attic" &&
        level.value !== "garage"
    )
    .reverse();

  return (
    <section className="overflow-hidden rounded-3xl border border-termo-300 bg-white shadow-[0_16px_40px_rgba(65,140,239,0.18)] dark:border-termo-700 dark:bg-slate-950 dark:shadow-black/30">
      <div className="border-b border-termo-100 bg-white px-5 py-4 dark:border-termo-900 dark:bg-slate-950">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-termo-600 dark:text-termo-300">
          Podgląd na żywo
        </p>
        <h4 className="mt-1 text-lg font-black">Bryła budynku</h4>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Kliknij poziom na grafice, aby zmienić jego ogrzewanie.
        </p>
      </div>

      <div className="overflow-x-auto bg-slate-50/90 px-5 py-7 dark:bg-slate-900/80">
        <div className="flex min-w-[350px] items-end justify-center">
          <div className="relative flex items-end">
            {hasBasement && (
              <div
                aria-hidden="true"
                className="absolute -left-3 -right-3 bottom-0 h-14 bg-stone-300/90 shadow-[inset_0_10px_18px_rgba(68,64,60,0.14)] dark:bg-stone-800/90"
              />
            )}

            <div className="relative z-10 shrink-0">
              {roofType === "flat" ? (
                <div className="flex h-7 w-56 items-center justify-center rounded-t-xl border-2 border-b-0 border-slate-500 bg-slate-300 text-[10px] font-black uppercase tracking-wide text-slate-700 dark:border-slate-500 dark:bg-slate-700 dark:text-slate-200">
                  Dach płaski
                </div>
              ) : (
                <PitchedRoof
                  withAttic={roofType === "pitched_with_attic"}
                  heated={heated.has("attic")}
                  onToggle={onToggleLevel}
                />
              )}

              <div>
                {aboveGroundLevels.map((level) => (
                  <LevelButton
                    key={level.value}
                    level={level.value}
                    heated={heated.has(level.value)}
                    onToggle={onToggleLevel}
                  />
                ))}
              </div>

              {hasBasement && (
                <GroundLevelMarker hasGarage={hasIntegratedGarage} />
              )}

              {hasBasement && (
                <LevelButton
                  level="basement"
                  heated={heated.has("basement")}
                  basement
                  onToggle={onToggleLevel}
                />
              )}
            </div>

            {hasIntegratedGarage && (
              <GarageButton
                heated={heated.has("garage")}
                hasBasement={hasBasement}
                onToggle={onToggleLevel}
              />
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 border-t border-termo-100 px-5 py-3 text-xs font-semibold text-slate-600 dark:border-termo-900 dark:text-slate-300">
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded bg-termo-400" /> Ogrzewane
        </span>
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded bg-slate-300 dark:bg-slate-700" />
          Nieogrzewane
        </span>
      </div>
    </section>
  );
}
