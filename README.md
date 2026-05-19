# Power BI Time Slicer Visual

A Power BI custom visual for filtering report data by a time-formatted field.

## Features

- **Dual Range Slider**: Select start and end times with a dual-handle range slider
- **Playback Snap Interval**: Choose 1, 5, 10, 15, 30, or 60 minute snapping for playback and range movement
- **Live Duration Label**: See the selected duration update as the handles move
- **Auto-Play**: Automatically move the selected time range forward by the playback snap interval, looping back to `00:00` after the end of the day
- **Quick Select Buttons**: Four fully editable preset ranges, with defaults for AM Peak, Inter-Peak, PM Peak, and Custom
- **Customizable Appearance**: Change colors, time formats, preset labels, preset ranges, and show/hide labels
- **Responsive Design**: Works well on different screen sizes
- **Accessibility**: Keyboard navigation and focus indicators

## Installation

### Prerequisites

1. Install Power BI Custom Visuals Tools:

   ```powershell
   npm install -g powerbi-visuals-tools
   ```

2. Install the dependencies:
   ```powershell
   cd powerbi-time-slicer
   npm install
   ```

### Building the Visual

1. Build the visual:

   ```powershell
   npm run build
   ```

2. Package the visual:
   ```powershell
   npm run package
   ```

This will create a `.pbiviz` file in the `dist` folder that can be imported into Power BI.

### Testing in Power BI Web

You have two browser testing options in Power BI Service:

1. **Live developer testing** with `pbiviz start`
2. **Packaged import testing** with a generated `.pbiviz`

Use live developer testing while building the visual, and use packaged import testing when you want to verify the final artifact behaves the way users will receive it.

#### Option 1: Live developer testing with `pbiviz start`

This option does **not** require creating a `.pbiviz` file for every change. It does require the project dependencies to be installed once with `npm install`, which creates the `node_modules` folder.

1. Install dependencies if you have not already:

   ```powershell
   npm install
   ```

2. Start the local development server:

   ```powershell
   npm start
   ```

3. Enable developer mode in Power BI Service.

4. Open or create a report in Power BI Service and add the **Developer Visual**.

5. Point the Developer Visual at the local visual served by `pbiviz start`.

6. Make code changes and refresh the report as needed. This is the fastest way to test behavior in the browser during development.

Notes:

- `npm start` uses the `pbiviz start` script already defined in this project.
- `pbiviz start` serves the visual locally for debugging; it does not create the distributable `.pbiviz` package.
- The large `node_modules` folder comes from `npm install`, not from `npm start` or `npm run package`.

#### Option 2: Packaged import testing with `.pbiviz`

Use this path when you want to test the packaged artifact that will actually be imported into Power BI.

1. Build a fresh package before each browser test cycle:

   ```powershell
   npm run package
   ```

2. Confirm that the packaged file exists in `dist/` and note the current version. This project produces a file named like `timeSlicer_1234567890.1.1.0.0.pbiviz`.

3. Sign in to [Power BI Service](https://app.powerbi.com/) and open a workspace where you can edit reports.

4. Create a test report or open an existing report that uses a dataset with a single time or date/time column you can map to the visual's **Time Field** role.

5. In report edit mode, open the **Visualizations** pane, select the three dots, then choose **Import a visual from a file**.

6. Upload the packaged `.pbiviz` file from `dist/`. If your tenant blocks custom visual imports, test in Power BI Desktop first or ask your Power BI administrator to enable custom visual imports for your workspace.

7. Add **Time Slicer** to the report canvas and drag your source column into **Time Field**.

8. Verify the main browser behaviors:
   - Move both slider handles and confirm the selected range updates.
   - Check that other visuals on the page cross-filter when the range changes.
   - Use **Reset** and confirm the full dataset returns.
   - Exercise quick-select buttons and autoplay if they are enabled in the current build.
   - Resize the browser window and confirm the layout remains usable at narrower widths.

9. Open the report in reading view after saving and confirm the visual still filters correctly outside edit mode.

10. For each new code change, rebuild with `npm run package`, remove the old visual instance if needed, and re-import the updated `.pbiviz` so the service uses the latest package.

Recommended browser test checklist:

- Prefer `npm start` plus Developer Visual while iterating on code.
- Test in both Chrome and Edge, since Power BI Service is most commonly used there.
- Validate with a small dataset first so filter behavior is easy to inspect.
- Include at least one table visual on the page to make range-filter verification obvious.
- If the visual appears unchanged after re-import, clear the browser cache or upload a package with an incremented version in `pbiviz.json`.

## Usage

1. **Import the Visual**: In Power BI Desktop, click on "Import a visual from a file" and select the generated `.pbiviz` file.

2. **Add Data**: Drag the visual to your report canvas and add a time, date, or datetime field to the "Time Field" data role.

3. **Configure**: Use the formatting options to customize:
   - Slider color
   - Background color
   - Text color
   - Time format
   - Playback snap interval
   - Quick-select preset labels and start/end times
   - Show/hide labels

## Controls

- **Range Sliders**: Drag the handles to select start and end times
- **Duration Badge**: Shows the currently selected duration, such as `1h 30m selected`
- **Play Button**: Auto-animate through time periods
- **Reset Button**: Return to the full day
- **Quick Select**: Buttons for editable common time periods

## Data Requirements

- **Time Field**: A time, date, or datetime column from your dataset

## Customization Options

### Time Slicer Settings

- **Accent Color**: Color of the slider track and time bucket buttons
- **Background Color**: Background color of the visual
- **Text Color**: Color of all text elements
- **Show Labels**: Toggle time labels visibility
- **Time Format**: Choose 24-hour (`HH:MM`) or 12-hour (`h:mm A`) display
- **Playback Snap Interval**: Choose 1, 5, 10, 15, 30, or 60 minute increments

### Custom Time Filters

The format pane shows four generic editable slots: `Preset 1`, `Preset 2`, `Preset 3`, and `Preset 4`. Each preset has a label, start time, and end time, so the defaults can be repurposed to any time range.

- **Preset 1**: Default label `AM Peak`, from `07:00` to `09:00`
- **Preset 2**: Default label `Inter-Peak`, from `10:00` to `12:00`
- **Preset 3**: Default label `PM Peak`, from `16:00` to `18:00`
- **Preset 4**: Default label `Custom`, from `09:00` to `17:00`
- Start and end fields accept friendly time text such as `02:00`, `2:00 AM`, or `0200`

## Development

### Project Structure

```
powerbi-time-slicer/
├── src/
│   └── visual.ts          # Main visual logic
├── style/
│   └── visual.less        # Styling
├── assets/
│   └── icon.svg          # Visual icon
├── capabilities.json      # Visual capabilities
├── package.json          # Dependencies
├── pbiviz.json           # Visual metadata
└── tsconfig.json         # TypeScript config
```

### Key Features Implementation

1. **Dual Range Slider**: Uses two HTML range inputs overlaid to create a dual-handle slider
2. **Time Filtering**: Applies Power BI advanced filters based on the selected time range
3. **Auto-Play**: Uses `setInterval` to advance the active range by the playback snap interval and loop back to the start of the day
4. **Responsive Design**: CSS flexbox and media queries for different screen sizes
5. **Settings Panel**: Power BI formatting options for customization

## Release Process

1. Confirm the working tree contains the intended release changes:

   ```powershell
   git status
   ```

2. Run the regression test:

   ```powershell
   npm test
   ```

3. Build the distributable visual:

   ```powershell
   npm run package
   ```

4. Confirm the `.pbiviz` file exists in `dist/`.

5. Commit the release changes and create a version tag:

   ```powershell
   git add README.md CHANGELOG.md package.json package-lock.json pbiviz.json capabilities.json src/visual.ts tests/filtering.test.ts
   git commit -m "Release v1.1"
   git tag v1.1
   git push origin main --tags
   ```

6. Create the GitHub release and upload the packaged visual:

   ```powershell
   gh release create v1.1 dist/timeSlicer_1234567890.1.1.0.0.pbiviz --repo Feltzem/powerbi-time-slicer --title "Time Slicer 1.1" --notes-file CHANGELOG.md
   ```

If you prefer the GitHub website, open the repository, choose **Releases**, draft a new release for tag `v1.1`, paste the `CHANGELOG.md` notes, and attach the `.pbiviz` file from `dist/`.

## Browser Support

- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

## License

This project is licensed under the MIT License.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## Support

For issues and feature requests, please create an issue in the repository.
