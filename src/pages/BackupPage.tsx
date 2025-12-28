import React, { useState } from "react";
import { useDB } from "../db/DBContext";
import { exportDB, importDB, resetDB } from "../storage";
import { Panel, Button, DangerButton } from "../components/ui";
import { useActiveRecord } from "../ui/ActiveRecordContext";

export default function BackupPage() {
  const { reload } = useDB();
  const { clearActive } = useActiveRecord();
  const [text, setText] = useState("");

  return (
    <Panel
      title="Backup / Restore"
      right={
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Button onClick={() => setText(exportDB())}>Export</Button>
          <Button
            onClick={() => {
              importDB(text);
              reload();
              alert("Imported and reloaded.");
            }}
          >
            Import
          </Button>
          <DangerButton
            onClick={() => {
              if (!confirm("Reset DB to empty?\n\nThis cannot be undone.")) return;
              resetDB();
              clearActive();
              reload();
              alert("DB reset.");
            }}
          >
            Reset DB
          </DangerButton>
        </div>
      }
    >
      <div style={{ opacity: 0.8, marginBottom: 8 }}>
        Export gives you JSON. Import overwrites current data.
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        style={{ width: "100%", minHeight: 360, padding: 12, borderRadius: 12, border: "1px solid #ccc" }}
        placeholder="Click Export to generate JSON here, or paste JSON here then Import."
      />
    </Panel>
  );
}
