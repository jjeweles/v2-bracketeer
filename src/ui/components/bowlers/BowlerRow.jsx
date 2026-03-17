import { toMoney } from "../../lib/format";
import { EditableCellButton } from "./EditableCellButton";

export function BowlerRow({
  bowler,
  sessionCompleted,
  editingCell,
  setEditingCell,
  nameDrafts,
  setNameDrafts,
  averageDrafts,
  setAverageDrafts,
  scratchEntriesDrafts,
  setScratchEntriesDrafts,
  handicapEntriesDrafts,
  setHandicapEntriesDrafts,
  onUpdateAverage,
  updateBowlerField,
  cancelCellEdit,
  togglePayLater,
  owedByBowler,
  onClickDelete,
}) {
  const isEditingName =
    editingCell?.bowlerId === bowler.id && editingCell?.field === "name";
  const isEditingAverage =
    editingCell?.bowlerId === bowler.id && editingCell?.field === "average";
  const isEditingScratch =
    editingCell?.bowlerId === bowler.id &&
    editingCell?.field === "scratch_entries";
  const isEditingHandicap =
    editingCell?.bowlerId === bowler.id &&
    editingCell?.field === "handicap_entries";

  function startEdit(field) {
    setEditingCell({ bowlerId: bowler.id, field });
  }

  function saveName() {
    const name = String(nameDrafts[bowler.id] ?? "").trim();
    void updateBowlerField(bowler.id, { name }, "Name");
  }

  function saveScratchEntries() {
    const scratchEntries = Number(scratchEntriesDrafts[bowler.id]);
    void updateBowlerField(bowler.id, { scratchEntries }, "Scratch entries");
  }

  function saveHandicapEntries() {
    const handicapEntries = Number(handicapEntriesDrafts[bowler.id]);
    void updateBowlerField(bowler.id, { handicapEntries }, "Handicap entries");
  }

  return (
    <tr>
      <td>
        <EditableCellButton
          isEditing={isEditingName}
          sessionCompleted={sessionCompleted}
          draftValue={nameDrafts[bowler.id] ?? ""}
          onDraftChange={(next) =>
            setNameDrafts((prev) => ({ ...prev, [bowler.id]: next }))
          }
          onSave={saveName}
          onCancel={() => cancelCellEdit(bowler.id, "name", bowler)}
          onStartEdit={() => {
            setNameDrafts((prev) => ({ ...prev, [bowler.id]: bowler.name }));
            startEdit("name");
          }}
          displayValue={bowler.displayName}
        />
      </td>

      <td>
        <EditableCellButton
          isEditing={isEditingAverage}
          sessionCompleted={sessionCompleted}
          draftValue={averageDrafts[bowler.id] ?? ""}
          onDraftChange={(next) =>
            setAverageDrafts((prev) => ({ ...prev, [bowler.id]: next }))
          }
          onSave={() => void onUpdateAverage(bowler.id)}
          onCancel={() => cancelCellEdit(bowler.id, "average", bowler)}
          onStartEdit={() => {
            setAverageDrafts((prev) => ({
              ...prev,
              [bowler.id]: String(bowler.average),
            }));
            startEdit("average");
          }}
          displayValue={bowler.average}
          inputType="number"
          inputMin="0"
        />
      </td>

      <td>{bowler.handicap_value}</td>

      <td>
        <EditableCellButton
          isEditing={isEditingScratch}
          sessionCompleted={sessionCompleted}
          draftValue={scratchEntriesDrafts[bowler.id] ?? ""}
          onDraftChange={(next) =>
            setScratchEntriesDrafts((prev) => ({ ...prev, [bowler.id]: next }))
          }
          onSave={saveScratchEntries}
          onCancel={() => cancelCellEdit(bowler.id, "scratch_entries", bowler)}
          onStartEdit={() => {
            setScratchEntriesDrafts((prev) => ({
              ...prev,
              [bowler.id]: String(bowler.scratch_entries),
            }));
            startEdit("scratch_entries");
          }}
          displayValue={bowler.scratch_entries}
          inputType="number"
          inputMin="0"
        />
      </td>

      <td>
        <EditableCellButton
          isEditing={isEditingHandicap}
          sessionCompleted={sessionCompleted}
          draftValue={handicapEntriesDrafts[bowler.id] ?? ""}
          onDraftChange={(next) =>
            setHandicapEntriesDrafts((prev) => ({
              ...prev,
              [bowler.id]: next,
            }))
          }
          onSave={saveHandicapEntries}
          onCancel={() => cancelCellEdit(bowler.id, "handicap_entries", bowler)}
          onStartEdit={() => {
            setHandicapEntriesDrafts((prev) => ({
              ...prev,
              [bowler.id]: String(bowler.handicap_entries),
            }));
            startEdit("handicap_entries");
          }}
          displayValue={bowler.handicap_entries}
          inputType="number"
          inputMin="0"
        />
      </td>

      <td>
        <button
          type="button"
          className={`mini-btn ${bowler.pay_later ? "" : "secondary"}`}
          disabled={sessionCompleted}
          onClick={() => void togglePayLater(bowler)}
        >
          {bowler.pay_later ? "Yes" : "No"}
        </button>
      </td>

      <td>
        <div className="inline-stepper">
          <select
            value={bowler.all_brackets_mode || "off"}
            disabled={sessionCompleted}
            onChange={(e) => {
              const mode = e.target.value;
              void updateBowlerField(
                bowler.id,
                {
                  allBracketsMode: mode,
                  allBracketsCount: mode === "off" ? 0 : 1,
                },
                "All brackets mode",
              );
            }}
          >
            <option value="off">Off</option>
            <option value="both">All (Both)</option>
            <option value="handicap">All-Handicap</option>
            <option value="scratch">All-Scratch</option>
          </select>
        </div>
      </td>

      <td>{toMoney(owedByBowler.get(bowler.id) ?? 0)}</td>

      <td className="actions">
        <button
          type="button"
          className="icon-button danger"
          disabled={sessionCompleted}
          onClick={() => onClickDelete(bowler.id)}
        >
          Delete
        </button>
      </td>
    </tr>
  );
}
