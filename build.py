#!/usr/bin/env python3
"""Assemble the two self-contained notebook HTML files from src/."""
import os, sys
from pathlib import Path

SRC = Path(__file__).parent / "src"
read = lambda n: (SRC / n).read_text(encoding="utf-8")

BOOKS = [
    dict(out="notebook-1-keypad-timer-lcd.html", key="nb1",
         title="Keypad, Timer & LCD notes",
         desc="Hand-drawn LPC1768 study notes: matrix keyboard, 7-segment, timer/counter and 16x2 LCD with interactive widgets."),
    dict(out="notebook-2-interrupts-adc-dac-pwm-uart.html", key="nb2",
         title="Interrupts, ADC, DAC, PWM & UART notes",
         desc="Hand-drawn LPC1768 study notes: NVIC, timer/external/GPIO interrupts, ADC, DAC, stepper motor, PWM and UART with interactive widgets."),
]

shell = read("shell.html")
only = set(sys.argv[1:])          # e.g. `python3 build.py nb1` builds just notebook 1
for b in BOOKS:
    k = b["key"]
    if only and k not in only:
        continue
    if not (SRC / f"{k}.html").exists():
        print("skip", k); continue
    css = "\n".join([read("core.css"), read("widgets.css"), read(f"{k}.css")]
                     + [p.read_text(encoding="utf-8") for p in sorted(SRC.glob(f"{k}_*.css"))])
    parts = sorted(SRC.glob(f"{k}_*.js"))
    js = read("core.js") + "\n" + "\n".join(p.read_text(encoding="utf-8") for p in parts) + "\nbootCore();\n"
    html = (shell.replace("{{TITLE}}", b["title"]).replace("{{DESC}}", b["desc"])
            .replace("{{CSS}}", css).replace("{{DEFS}}", read("defs.html"))
            .replace("{{BODY}}", read(f"{k}.html")).replace("{{JS}}", js))
    out = Path(__file__).parent / b["out"]
    tmp = out.with_suffix(".tmp")
    tmp.write_text(html, encoding="utf-8")
    os.replace(tmp, out)              # atomic, so parallel builds never leave a half-written file
    print(f"wrote {b['out']}  ({len(html)//1024} KB)")
