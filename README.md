# GIS Day Santa Clara 2026

Yoh Kawano’s HTML presentation.

Open `index.html` locally or use GitHub Pages. No dependencies or build step.

Arrow keys or Space advance. Swipe on touch screens. F toggles fullscreen, O opens the overview, N opens optional speaker cues, and B blanks the screen. Controls disappear while presenting.

## Sources

Selected original images from Yoh’s decks:

- [Disaster research and Human Error](https://docs.google.com/presentation/d/1uw0dEqS3s9ILpHObI-v_7bSmMJ3ctJ93QNtwSyBNDJ8/edit)
- [History of web mapping](https://docs.google.com/presentation/d/1yMkD9n1XITax5FGPjBi1xWmJxr3Vex2ZyiNTrRXTg3k/edit)
- [Yoh’s portfolio](https://yohman.github.io/yoh/index.html?lang=en)

Photographs display in black and white. Mapping screenshots retain their original colors, which encode information. Source images retain their proportions. Archival interfaces and satellite imagery fit the screen without cropping.

The last slide provides the spoken handoff to two students. Their names and portraits have not been inferred from group photographs.

Images remain the property of their original rights holders. No license to reuse the photography or source material is granted by this repository.


## Expanded visual sequence

The current deck uses locally hosted IM FELL English by Igino Marini, with a historical engraved lettering character (SIL Open Font License, see MAP-FONT-LICENSE.txt). Selected words are emphasized through brightness and italics.

Additional sources:

- Biography screenshot: https://yohman.github.io/yoh/about.html?lang=en
- HyperCities 2026 screenshots: https://github.com/yohman/hypercities/tree/main/assets/readme
- Selected Fukushima production photographs supplied by Yoh (2017 and 2025).
- Selected photographs from the Airi film shoot supplied by Yoh (February 2026).

The historical NKCA screenshot comes from slide 14 of the supplied mapping deck. Screenshots of historical interfaces and the 2026 HyperCities remain uncropped.

## Review and reorder

Open **Edit slides**, press **E** or **O**, or visit `?edit` to review the 255-slide source collection. Click an image to present from it. Drag a card by its grip to reorder. The earlier/later arrows and **Move to** number work on touch devices too. Select multiple cards to remove or move a group; Shift-click selects a range. Search and chapter filters narrow the collection.

Edits save automatically in the current browser using local storage. They change that browser’s presentation, not the shared GitHub source or another device. Removed slides remain in **Removed** and can be restored. Undo/redo applies during the current page session. New source images can be added later without resurrecting deleted slides.

Use **Export edits** to download a JSON file with the selected slides, order, removed IDs, and source notes. Import it on another browser or send it back for the PowerPoint phase. **Download HTML** creates an edited HTML snapshot; its images, scripts, and fonts load from the published website, so it requires an internet connection. No PowerPoint file is generated in this phase.

The expanded collection includes 192 additional images from both source presentations, the portfolio, and the two supplied Google Photos albums. The album titled “Fukushima Airi Film Shoot Feb 21, 2026” contains photographs with both 2017 and 2026 recorded camera dates; the notes retain this distinction. Near-duplicate shots are intentionally retained for review. New album JPEGs are orientation-correct and stripped of camera metadata.

Run `node tests/review-state.test.cjs` to check review state operations. No build step is required.
