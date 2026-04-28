# Power BI Time Slicer Visual

A beautiful and intuitive time slicer custom visual for Power BI that allows users to filter data by a time formatted field

## Features

- **Dual Range Slider**: Select start and end dates with dual-handle range slider
- **Auto-Play**: Automatically animate through time periods
- **Quick Select Buttons**: Preset options for Last 7, 30, 90 days, and Last Year
- **Customizable Appearance**: Change colors, date formats, and show/hide labels
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

## Usage

1. **Import the Visual**: In Power BI Desktop, click on "Import a visual from a file" and select the generated `.pbiviz` file.

2. **Add Data**: Drag the visual to your report canvas and add a date field to the "Date Field" data role.

3. **Configure**: Use the formatting options to customize:
   - Slider color
   - Background color
   - Text color
   - Date format
   - Show/hide labels

## Controls

- **Range Sliders**: Drag the handles to select start and end dates
- **Play Button**: Auto-animate through time periods
- **Reset Button**: Return to full date range
- **Quick Select**: Buttons for common time periods

## Data Requirements

- **Date Field**: A date/datetime column from your dataset

## Customization Options

### Time Slicer Settings

- **Accent Color**: Color of the slider track and time bucket buttons
- **Background Color**: Background color of the visual
- **Text Color**: Color of all text elements
- **Show Labels**: Toggle date labels visibility
- **Date Format**: Choose from multiple date format options:
  - MM/DD/YYYY
  - DD/MM/YYYY
  - YYYY-MM-DD
  - MMM DD, YYYY

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
2. **Date Filtering**: Applies Power BI filters based on selected date range
3. **Auto-Play**: Uses setInterval to animate through time periods
4. **Responsive Design**: CSS flexbox and media queries for different screen sizes
5. **Settings Panel**: Power BI formatting options for customization

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
