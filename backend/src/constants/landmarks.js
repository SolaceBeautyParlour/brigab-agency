// KNUST's fixed access points — confirmed real via research (not guessed):
// Engineering Gate and Bomso Gate are the two commonly-referenced student
// entry points near Ayeduase/Bomso; KSB (Ayim Complex, P.V. Obeng Ave) sits
// near Kotei; Medical Village is in Boadi. Main Gate/Tech Junction is the
// primary transport hub. Search queries are deliberately specific so the
// geocoder doesn't return some unrelated place with a similar name.
export const KNUST_LANDMARKS = [
  { name: "Engineering Gate", searchQuery: "KNUST Engineering Gate, Ayeduase, Kumasi, Ghana" },
  { name: "Bomso Gate", searchQuery: "KNUST Bomso Gate, Kumasi, Ghana" },
  { name: "Main Gate", searchQuery: "KNUST Main Gate, Tech Junction, Kumasi, Ghana" },
  { name: "KSB", searchQuery: "KNUST School of Business, Ayim Complex, Kumasi, Ghana" },
  { name: "Medical Village", searchQuery: "Kumasi Medical Village, Boadi, Kumasi, Ghana" },
];
