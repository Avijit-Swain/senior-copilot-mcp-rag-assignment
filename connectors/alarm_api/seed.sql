PRAGMA foreign_keys = ON;

INSERT OR REPLACE INTO sites(site_id, name, region, timezone) VALUES
('SITE-NORTH', 'NorthPlant', 'North', 'UTC'),
('SITE-SOUTH', 'SouthPlant', 'South', 'UTC'),
('SITE-EAST', 'EastRefinery', 'East', 'UTC');

INSERT OR REPLACE INTO units(unit_id, site_id, name, process_area) VALUES
('UNIT-N-1', 'SITE-NORTH', 'Unit 1', 'Utilities'),
('UNIT-N-5', 'SITE-NORTH', 'Unit 5', 'Boiler Feedwater'),
('UNIT-S-2', 'SITE-SOUTH', 'Unit 2', 'Compression'),
('UNIT-E-3', 'SITE-EAST', 'Unit 3', 'Crude Distillation'),
('UNIT-E-5', 'SITE-EAST', 'Unit 5', 'Motor Control Center');

INSERT OR REPLACE INTO assets(asset_id, unit_id, asset_name, asset_type, tag, manufacturer, model, criticality, status, commissioned_at, metadata_json) VALUES
('BFP-101', 'UNIT-N-5', 'Boiler Feed Pump 101', 'pump', 'N5-BFP-101', 'ABB', 'BFP-XR', 'critical', 'running', '2020-04-15', '{"rated_flow_m3h":420,"rated_pressure_bar":82,"service":"boiler feedwater"}'),
('BFP-102', 'UNIT-N-5', 'Boiler Feed Pump 102', 'pump', 'N5-BFP-102', 'ABB', 'BFP-XR', 'critical', 'standby', '2020-04-15', '{"rated_flow_m3h":420,"rated_pressure_bar":82,"service":"boiler feedwater"}'),
('DRV-101', 'UNIT-N-5', 'BFP 101 Variable Speed Drive', 'drive', 'N5-VSD-101', 'ABB', 'ACS880', 'high', 'running', '2020-04-15', '{"rated_kw":900}'),
('PT-101D', 'UNIT-N-5', 'BFP 101 Discharge Pressure Transmitter', 'instrument', 'N5-PT-101D', 'ABB', '266HSH', 'high', 'running', '2020-04-15', '{"range_bar":"0-120"}'),
('DV-101', 'UNIT-N-5', 'BFP 101 Discharge Control Valve', 'valve', 'N5-DV-101', 'ABB', 'TZIDC', 'high', 'running', '2020-04-15', '{"fail_position":"open"}'),
('CMP-201', 'UNIT-S-2', 'Compressor A Discharge Train', 'compressor', 'S2-CMP-201', 'ABB', 'CMP-A', 'critical', 'running', '2019-10-02', '{"service":"process air"}'),
('CMP-202', 'UNIT-S-2', 'Compressor B Discharge Train', 'compressor', 'S2-CMP-202', 'ABB', 'CMP-B', 'high', 'running', '2019-10-02', '{"service":"process air"}'),
('CMP-203', 'UNIT-E-3', 'Compressor C Recycle Train', 'compressor', 'E3-CMP-203', 'ABB', 'CMP-C', 'high', 'running', '2021-06-11', '{"service":"recycle gas"}'),
('CMP-501', 'UNIT-N-5', 'Unit 5 Instrument Air Compressor 501', 'compressor', 'N5-CMP-501', 'ABB', 'CMP-U5A', 'high', 'running', '2021-06-11', '{"service":"instrument air"}'),
('CMP-502', 'UNIT-N-5', 'Unit 5 Instrument Air Compressor 502', 'compressor', 'N5-CMP-502', 'ABB', 'CMP-U5B', 'high', 'standby', '2021-06-11', '{"service":"instrument air"}'),
('CMP-503', 'UNIT-E-5', 'Unit 5 Recycle Gas Compressor 503', 'compressor', 'E5-CMP-503', 'ABB', 'CMP-U5C', 'critical', 'running', '2022-08-19', '{"service":"recycle gas"}'),
('MTR-301', 'UNIT-E-5', 'Main Cooling Water Motor 301', 'motor', 'E5-MTR-301', 'ABB', 'M3BP', 'critical', 'running', '2018-03-21', '{"rated_kw":650}'),
('MTR-302', 'UNIT-E-5', 'Boiler Fan Motor 302', 'motor', 'E5-MTR-302', 'ABB', 'M3BP', 'high', 'running', '2018-03-21', '{"rated_kw":500}'),
('MTR-303', 'UNIT-N-5', 'BFP Auxiliary Lube Oil Motor 303', 'motor', 'N5-MTR-303', 'ABB', 'M2BAX', 'medium', 'running', '2022-01-18', '{"rated_kw":45}');

INSERT OR IGNORE INTO asset_relationships(source_asset_id, target_asset_id, relationship_type, description) VALUES
('BFP-101', 'DRV-101', 'driven_by', 'Pump speed is controlled by the variable speed drive.'),
('BFP-101', 'PT-101D', 'instrumented_by', 'Discharge pressure alarm depends on this transmitter.'),
('BFP-101', 'DV-101', 'downstream', 'Discharge valve position can create high pressure events.'),
('DRV-101', 'MTR-303', 'related', 'Auxiliary lube oil motor supports the pump train.'),
('CMP-201', 'CMP-202', 'related', 'Parallel compressor train.'),
('MTR-301', 'MTR-302', 'related', 'Same MCC lineup in EastRefinery Unit 5.');

INSERT OR REPLACE INTO alarms(alarm_id, asset_id, alarm_name, alarm_type, severity, status, start_time, end_time, acknowledged_at, ack_delay_seconds, message, probable_cause, process_value, process_value_unit, setpoint, alarm_limit, metadata_json) VALUES
('ALM-BFP101-DP-HH', 'BFP-101', 'Discharge Pressure High High', 'safety', 'critical', 'active', '2026-07-20T09:14:00Z', NULL, '2026-07-20T09:19:00Z', 300, 'BFP 101 discharge pressure exceeded high-high limit.', 'Downstream valve restriction or transmitter drift', 91.4, 'bar', 82.0, 90.0, '{"procedure_id":"BFP-OP-102","recurring_90d":true}'),
('ALM-BFP101-FLOW-LOW', 'BFP-101', 'Feedwater Flow Low', 'device', 'high', 'active', '2026-07-18T11:02:00Z', NULL, '2026-07-18T11:09:00Z', 420, 'BFP 101 feedwater flow below operating envelope.', 'Suction strainer fouling or downstream control instability', 255.0, 'm3/h', 420.0, 300.0, '{"procedure_id":"BFP-TS-044","recurring_90d":true}'),
('ALM-BFP101-VIB-H', 'BFP-101', 'Pump Vibration High', 'device', 'high', 'acknowledged', '2026-06-28T03:40:00Z', NULL, '2026-06-28T03:48:00Z', 480, 'BFP 101 vibration above alert threshold.', 'Cavitation or bearing wear after pressure transients', 7.1, 'mm/s', 4.5, 7.0, '{"procedure_id":"BFP-MM-210","recurring_90d":true}'),
('ALM-BFP102-DP-H', 'BFP-102', 'Discharge Pressure High', 'device', 'high', 'active', '2026-07-19T15:26:00Z', NULL, '2026-07-19T15:35:00Z', 540, 'BFP 102 discharge pressure exceeded high limit.', 'Standby pump check valve leakage or header restriction', 86.8, 'bar', 82.0, 85.0, '{"procedure_id":"BFP-OP-102"}'),
('ALM-CMP201-DP-H', 'CMP-201', 'Compressor Discharge Pressure High', 'safety', 'critical', 'active', '2026-06-26T07:11:00Z', NULL, '2026-06-26T07:14:00Z', 180, 'Compressor A discharge pressure repeatedly high.', 'Recycle valve sluggish response', 42.5, 'bar', 36.0, 41.0, '{"procedure_id":"CMP-TS-120"}'),
('ALM-MTR301-TRIP', 'MTR-301', 'Motor Trip', 'safety', 'critical', 'active', '2026-07-21T02:05:00Z', NULL, '2026-07-21T02:06:00Z', 60, 'Main cooling water motor tripped on protection relay.', 'Overcurrent or bearing temperature excursion', 720.0, 'A', 610.0, 700.0, '{"procedure_id":"MTR-SAFE-030"}');

INSERT OR REPLACE INTO alarm_occurrences(occurrence_id, alarm_id, occurred_at, cleared_at, severity, ack_delay_seconds, operator_id, notes) VALUES
('OCC-BFP101-DP-001', 'ALM-BFP101-DP-HH', '2026-05-08T08:22:00Z', '2026-05-08T08:51:00Z', 'high', 360, 'operator-a', 'Cleared after reducing pump speed.'),
('OCC-BFP101-DP-002', 'ALM-BFP101-DP-HH', '2026-05-24T17:10:00Z', '2026-05-24T17:34:00Z', 'critical', 420, 'operator-b', 'Valve position oscillation observed.'),
('OCC-BFP101-DP-003', 'ALM-BFP101-DP-HH', '2026-06-09T04:42:00Z', '2026-06-09T05:04:00Z', 'critical', 300, 'operator-a', 'Pressure transmitter reading checked.'),
('OCC-BFP101-DP-004', 'ALM-BFP101-DP-HH', '2026-07-01T12:16:00Z', '2026-07-01T12:41:00Z', 'critical', 360, 'operator-c', 'Header demand changed rapidly.'),
('OCC-BFP101-DP-005', 'ALM-BFP101-DP-HH', '2026-07-20T09:14:00Z', NULL, 'critical', 300, 'operator-b', 'Active event.'),
('OCC-BFP101-FLOW-001', 'ALM-BFP101-FLOW-LOW', '2026-06-09T04:45:00Z', '2026-06-09T05:02:00Z', 'high', 390, 'operator-a', 'Coincident with discharge pressure alarm.'),
('OCC-BFP101-VIB-001', 'ALM-BFP101-VIB-H', '2026-06-28T03:40:00Z', NULL, 'high', 480, 'operator-d', 'Sustained vibration alert.'),
('OCC-CMP201-DP-001', 'ALM-CMP201-DP-H', '2026-06-26T07:11:00Z', NULL, 'critical', 180, 'operator-e', 'Active compressor alarm.'),
('OCC-MTR301-TRIP-001', 'ALM-MTR301-TRIP', '2026-07-21T02:05:00Z', NULL, 'critical', 60, 'operator-f', 'Active EastRefinery motor trip.');

INSERT OR REPLACE INTO alarm_correlations(correlation_id, primary_alarm_id, related_alarm_id, method, support_count, confidence, lag_minutes, explanation) VALUES
('CORR-BFP101-DP-FLOW', 'ALM-BFP101-DP-HH', 'ALM-BFP101-FLOW-LOW', 'cooccurrence', 3, 0.82, 5, 'Low flow events repeatedly occur within five minutes of discharge pressure spikes.'),
('CORR-BFP101-DP-VIB', 'ALM-BFP101-DP-HH', 'ALM-BFP101-VIB-H', 'cooccurrence', 2, 0.64, 15, 'Vibration alerts follow pressure excursions and may indicate cavitation stress.'),
('CORR-MTR301-MTR302', 'ALM-MTR301-TRIP', 'ALM-CMP201-DP-H', 'cooccurrence', 1, 0.41, 12, 'Weak site-level coincidence only; investigate electrical common cause before assuming process cause.');

INSERT OR REPLACE INTO priority_scores(score_id, alarm_id, score, priority_band, factors_json, computed_at) VALUES
('PRS-BFP101-DP-HH', 'ALM-BFP101-DP-HH', 94.0, 'urgent', '{"severity":35,"asset_criticality":25,"recurrence":20,"active_status":10,"operator_delay":4}', '2026-07-20T09:20:00Z'),
('PRS-BFP101-FLOW-LOW', 'ALM-BFP101-FLOW-LOW', 78.0, 'high', '{"severity":25,"asset_criticality":25,"recurrence":15,"active_status":10,"operator_delay":3}', '2026-07-18T11:10:00Z'),
('PRS-MTR301-TRIP', 'ALM-MTR301-TRIP', 91.0, 'urgent', '{"severity":35,"asset_criticality":25,"active_status":10,"safety_impact":18,"operator_delay":3}', '2026-07-21T02:07:00Z');

INSERT OR REPLACE INTO operator_recommendations(recommendation_id, alarm_id, asset_id, action_text, rationale, urgency, source, rank) VALUES
('REC-BFP101-001', 'ALM-BFP101-DP-HH', 'BFP-101', 'Verify discharge valve DV-101 position and check for restriction before increasing pump speed.', 'The strongest correlation links high discharge pressure with low flow and downstream valve behavior.', 'immediate', 'api_rule', 1),
('REC-BFP101-002', 'ALM-BFP101-DP-HH', 'PT-101D', 'Cross-check PT-101D against the local gauge and inspect impulse lines for blockage.', 'Instrument drift can mimic pressure excursions and is named in the alarm metadata.', 'immediate', 'engineering_rule', 2),
('REC-BFP101-003', 'ALM-BFP101-DP-HH', 'BFP-101', 'If pressure remains above limit, reduce load and follow BFP-OP-102 escalation.', 'Operating procedure requires stabilizing the pump before reset or restart.', 'immediate', 'historical_pattern', 3),
('REC-MTR301-001', 'ALM-MTR301-TRIP', 'MTR-301', 'Keep the motor isolated until protection relay and bearing temperature data are reviewed.', 'Critical motor trip may indicate electrical or mechanical protection action.', 'immediate', 'api_rule', 1);

INSERT OR REPLACE INTO kpi_definitions(kpi_name, display_name, description, unit, formula) VALUES
('alarm_count', 'Alarm count', 'Total alarms matching the selected filters.', 'count', 'count(alarms)'),
('recurring_rate', 'Recurring rate', 'Share of alarms with more than one occurrence in the selected time range.', 'ratio', 'recurring_alarms / total_alarms'),
('avg_ack_delay', 'Average acknowledgement delay', 'Mean time between alarm start and operator acknowledgement.', 'seconds', 'avg(ack_delay_seconds)'),
('critical_count', 'Critical alarm count', 'Number of critical severity alarms.', 'count', 'count(severity = critical)'),
('suppression_candidate_rate', 'Suppression candidate rate', 'Share of recurring low-action alarms eligible for rationalization review.', 'ratio', 'suppression_candidates / total_alarms');

INSERT OR REPLACE INTO calculation_templates(calculation_type, display_name, description, safe_formula, output_schema_json) VALUES
('alarm_flood_index', 'Alarm flood index', 'Counts alarm bursts within a configured window.', 'windowed_alarm_count / window_minutes', '{"type":"object","properties":{"alarm_flood_index":{"type":"number"},"flood_windows":{"type":"array"}}}'),
('critical_alarm_density', 'Critical alarm density', 'Critical alarms normalized by selected duration.', 'critical_count / days', '{"type":"object","properties":{"critical_alarm_density":{"type":"number"}}}'),
('operator_response_efficiency', 'Operator response efficiency', 'Compares acknowledgement delay against target response time.', 'target_ack_seconds / avg_ack_delay_seconds', '{"type":"object","properties":{"operator_response_efficiency":{"type":"number"}}}'),
('nuisance_alarm_score', 'Nuisance alarm score', 'Scores repeated alarms with low operator actionability.', 'recurrence_weight + ack_weight - severity_weight', '{"type":"object","properties":{"nuisance_alarm_score":{"type":"number"}}}');
