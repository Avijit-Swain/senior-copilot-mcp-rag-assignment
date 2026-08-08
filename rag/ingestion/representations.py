"""
Multi-representation index definitions.

Each document is indexed by several short natural-language statements rather
than by splitting it into chunks. Every statement is embedded separately and
all of a document's vectors resolve to the same whole document.

Why not chunk: the largest document in this corpus is ~1,100 tokens and the
whole corpus is ~5,100. There is no context-window pressure to relieve, and
splitting actively harms two scenarios the corpus was built for — the MM-207
§7.1/§7.3 conflict and the SOP-114 §3.2/§4 acceptance scenario both require
reasoning across sections that a chunker would separate.

Representation kinds
--------------------
    summary   One line stating what the document is and who it applies to.
    topic     A question-shaped statement of one area the document covers.
              Phrased the way an operator or engineer would actually ask, so
              the embedding sits near real queries rather than near prose.
    keywords  Entity and terminology view, for lexical-ish matches that
              paraphrase-heavy topic lines can miss.

Coverage note: topics are written per document by reading it, not generated.
They are the retrieval surface, so a missing topic is a retrieval blind spot.
"""

REPRESENTATIONS: dict[str, list[tuple[str, str]]] = {
    # ----------------------------------------------------------------- SOP-114
    "SOP-114": [
        ("summary",
         "Operating procedure for the operator response to a Suction Pressure Low alarm on "
         "boiler feed pumps at NorthPlant Unit 1, including Boiler Feed Pump 101 and 102."),
        ("topic",
         "What an operator should check first when a boiler feed pump raises a low suction "
         "pressure alarm, including deaerator level against the low-low setpoint."),
        ("topic",
         "When to initiate a suction strainer changeover, and the 0.4 bar differential "
         "pressure threshold that triggers it."),
        ("topic",
         "How to reduce pump demand safely after a suction pressure alarm, and why operating "
         "below the minimum flow setpoint is prohibited."),
        ("topic",
         "How many times a suction pressure alarm must recur before it is classified as "
         "recurring or chronic, and what action each classification requires."),
        ("topic",
         "What evidence to collect when investigating repeated high-severity alarms on a "
         "boiler feed pump over the last 90 days."),
        ("topic",
         "Criteria for escalating a recurring pump alarm to maintenance, including bearing "
         "temperature recovery and NPSH margin thresholds."),
        ("keywords",
         "boiler feed pump, BFP 101, BFP 102, suction pressure low, deaerator level, suction "
         "strainer, differential pressure, changeover, minimum flow, NorthPlant, Unit 1"),
    ],

    # ------------------------------------------------------------------ MM-207
    "MM-207": [
        ("summary",
         "Maintenance manual for horizontal centrifugal pumps in boiler feed, cooling water "
         "and transfer duty, covering inspection intervals, wear limits and removal criteria."),
        ("topic",
         "Scheduled inspection intervals for pump bearings, mechanical seal faces and "
         "coupling alignment."),
        ("topic",
         "When a pump must be removed from service rather than kept running, and the rule of "
         "more than five cavitation-induced suction transients in a rolling 30-day period."),
        ("topic",
         "Whether increased monitoring, trending or more frequent inspection can substitute "
         "for a mandatory pump removal from service."),
        ("topic",
         "Vibration velocity and bearing temperature limits used for condition monitoring on "
         "centrifugal pumps, and what a consequential thermal excursion means."),
        ("topic",
         "Wear limits and acceptance criteria measured after a pump inspection, including "
         "bearing clearance, seal face flatness and shaft runout."),
        ("topic",
         "Rules for deferring a scheduled pump inspection, who may authorise a deferral and "
         "for how long."),
        ("keywords",
         "centrifugal pump, inboard bearing, mechanical seal, cavitation transient, removal "
         "from service, inspection interval, deferral, wear limit, best efficiency point"),
    ],

    # ------------------------------------------------------------------ TG-051
    "TG-051": [
        ("summary",
         "Troubleshooting guide for diagnosing cavitation and net positive suction head "
         "deficiency in centrifugal pumps."),
        ("topic",
         "How to recognise cavitation from its acoustic signature, vibration energy and alarm "
         "pattern."),
        ("topic",
         "What it means when a low suction pressure alarm leads a high bearing temperature "
         "alarm by 10 to 20 minutes, and how lead and lag ordering identifies which is the "
         "primary cause."),
        ("topic",
         "How to calculate available NPSH and compare it against required NPSH at the actual "
         "recorded operating duty rather than at design duty."),
        ("topic",
         "Common suction-side causes of recurring low suction pressure, including strainer "
         "fouling, deaerator level instability, a drifting suction valve and air ingress."),
        ("topic",
         "How to tell intermittent cavitation apart from continuous cavitation, and why "
         "intermittent cavitation is often misattributed to a bearing fault."),
        ("keywords",
         "cavitation, NPSH, net positive suction head, vapour pressure, pump curve, lead lag, "
         "suction transient, broadband vibration, intermittent"),
    ],

    # ------------------------------------------------------------------ SI-009
    "SI-009": [
        ("summary",
         "Safety instruction governing isolation, lockout and tagging of rotating equipment "
         "before any physical inspection. Applies site-wide without exception."),
        ("topic",
         "The mandatory isolation, lockout, tagging and stored-energy steps required before "
         "opening or inspecting pump or compressor internals."),
        ("topic",
         "Whether a diagnostic recommendation from a monitoring system, analytics platform or "
         "automated assistant can authorise inspection without isolation."),
        ("topic",
         "Prohibited practices around rotating equipment, including removing guards on "
         "running machines and relying on a control-system stop as an isolation."),
        ("topic",
         "What to do when a procedure, instruction or system output conflicts with the safety "
         "instruction."),
        ("keywords",
         "lockout tagout, LOTO, isolation, stored energy, work permit, guard, rotating "
         "equipment, zero energy verification, HSE"),
    ],

    # ------------------------------------------------------------------ AP-001
    "AP-001": [
        ("summary",
         "Site alarm philosophy and rationalisation standard, aligned to ISA-18.2, covering "
         "priority assignment, performance targets, rationalisation and alarm floods."),
        ("topic",
         "How alarm priority is assigned from consequence of inaction and time available to "
         "respond, using the priority matrix."),
        ("topic",
         "How a composite alarm priority score is calculated and how severity, asset "
         "criticality and recurrence are weighted."),
        ("topic",
         "Alarm system performance targets, including alarms per operator per hour, mean "
         "acknowledgement delay and standing alarms at shift change."),
        ("topic",
         "Criteria that make an alarm a rationalisation candidate, covering nuisance, "
         "chattering, stale and redundant alarms."),
        ("topic",
         "What counts as an alarm flood and the rolling-window threshold that defines one."),
        ("topic",
         "Rules for changing an alarm setpoint, and why silencing a recurring alarm by moving "
         "its setpoint is treated as a bypass."),
        ("keywords",
         "ISA-18.2, alarm philosophy, priority matrix, P1 critical, rationalisation, nuisance "
         "alarm, chattering, stale alarm, alarm flood, acknowledgement delay, setpoint"),
    ],

    # ------------------------------------------------------------------ TG-088
    "TG-088": [
        ("summary",
         "Troubleshooting guide for investigating motor trips and electrical faults on "
         "medium-voltage drives, including Unit 5."),
        ("topic",
         "Which related assets must be inspected after a motor trip before a restart is "
         "authorised, and in what order."),
        ("topic",
         "How to classify a motor trip by the protection element that operated, and whether "
         "a restart is permitted before inspection."),
        ("topic",
         "When a motor overload trip is actually caused by a suction-side restriction in the "
         "driven pump rather than by a motor fault."),
        ("topic",
         "Restart authorisation requirements after a motor trip, including insulation "
         "resistance criteria."),
        ("keywords",
         "motor trip, drive motor, thermal overload, earth fault, overcurrent, undervoltage, "
         "protection relay, coupling, switchgear, insulation resistance, Unit 5, restart"),
    ],

    # ----------------------------------------------------------------- SOP-220
    "SOP-220": [
        ("summary",
         "Operating procedure for the operator response to a Discharge Pressure High alarm on "
         "centrifugal compressors at EastRefinery Unit 3."),
        ("topic",
         "Immediate operator response to a compressor discharge pressure high alarm, "
         "including anti-surge valve and discharge cooler checks."),
        ("topic",
         "Why compressor discharge pressure alarms repeatedly occur, and how to discriminate "
         "controller tuning drift from cooler fouling from a progressive downstream "
         "restriction."),
        ("topic",
         "When to escalate repeated compressor discharge pressure alarms, and the recurrence "
         "count that triggers escalation."),
        ("keywords",
         "compressor, discharge pressure high, anti-surge valve, surge, discharge cooler, "
         "fouling, downstream restriction, suction throttling, EastRefinery, Unit 3"),
    ],

    # ----------------------------------------------------------------- KB-3312
    "KB-3312": [
        ("summary",
         "Field service knowledge article on suction pressure alarms that continue after a "
         "strainer changeover has already been completed."),
        ("topic",
         "Why low suction pressure alarms keep occurring even after the suction strainer has "
         "been changed over to the standby element."),
        ("topic",
         "How to verify which strainer element is actually in service when the DCS graphic "
         "disagrees with the local position indicator."),
        ("keywords",
         "strainer changeover, standby element, fouled strainer, cleaning record, DCS graphic, "
         "local position indicator, field service"),
    ],
}


def flatten() -> list[dict]:
    """Every representation as a flat record, ready to embed."""
    out: list[dict] = []
    for doc_id, reps in REPRESENTATIONS.items():
        for i, (kind, text) in enumerate(reps):
            out.append({
                "rep_id": f"{doc_id}#r{i:02d}",
                "doc_id": doc_id,
                "rep_kind": kind,
                "text": text,
            })
    return out
