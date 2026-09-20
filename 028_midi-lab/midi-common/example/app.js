(function () {
  "use strict";
  const input = document.querySelector("#midiFile");
  const summary = document.querySelector("#summary");
  const tracks = document.querySelector("#tracks");

  input.addEventListener("change", async () => {
    const file = input.files[0];
    if (!file) return;
    try {
      const song = MidiCommon.parse(await file.arrayBuffer(), { fileName: file.name });
      summary.className = "";
      summary.textContent = `${song.title} / BPM ${song.bpm.toFixed(2)} / ${song.tracks.length} tracks / ${song.totalNotes} notes`;
      tracks.replaceChildren(...MidiCommon.getTracks(song).map((track) => {
        const row = document.createElement("tr");
        for (const value of [track.index + 1, track.name, track.notes.length]) {
          const cell = document.createElement("td"); cell.textContent = value; row.append(cell);
        }
        return row;
      }));
    } catch (error) {
      summary.className = "error"; summary.textContent = error.message; tracks.replaceChildren();
    }
  });
})();
