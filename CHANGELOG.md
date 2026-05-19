# Changelog

## 1.1 - 2026-05-19

### Added

- Added custom time filters with four editable preset ranges. Each preset supports a configurable label, start time, and end time.
- Added support for friendly preset time values such as `07:00`, `7:00 AM`, and `0700`.

### Changed

- Renamed the formatting setting from **Snap Interval** to **Playback Snap Interval**.
- Updated playback so the selected range advances by the configured playback snap interval and loops back to `00:00` after reaching the end of the day.

### Fixed

- Fixed autoplay being reset by incoming persisted filter state while playback is running.
- Preserved filter clear behavior when the range is reset to the full day.
