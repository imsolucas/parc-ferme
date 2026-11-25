// Only the OpenF1 fields this app reads. Shapes checked against the live API (Nov 2026).

export interface OfMeeting {
  meeting_key: number;
  meeting_name: string;
  location: string;
  country_name: string;
  year: number;
  is_cancelled?: boolean;
}

export interface OfSession {
  session_key: number;
  meeting_key: number;
  session_type: string; // "Practice" | "Qualifying" | "Race"
  session_name: string; // "Qualifying" | "Sprint Qualifying" | "Race" | "Sprint" | ...
  date_start: string;
  date_end: string;
  is_cancelled?: boolean;
}

export interface OfDriver {
  driver_number: number;
  name_acronym: string;
  full_name: string;
  team_name: string | null;
  team_colour: string | null;
}

export interface OfSessionResult {
  position: number | null;
  driver_number: number;
  number_of_laps?: number | null;
  /** undefined = unknown (row was rebuilt from the `position` fallback). */
  dnf?: boolean;
  dns?: boolean;
  dsq?: boolean;
}

export interface OfPosition {
  driver_number: number;
  position: number;
  date: string;
}

export interface OfLap {
  driver_number: number;
  lap_number: number;
  lap_duration: number | null;
  date_start?: string | null;
}

export interface OfRaceControl {
  date: string;
  lap_number: number | null;
  category: string | null;
  flag: string | null;
  message: string | null;
}
