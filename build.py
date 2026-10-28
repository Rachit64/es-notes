#!/usr/bin/env python3
"""Assemble the two self-contained notebook HTML files from src/."""
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
for b in BOOKS:
    k = b["key"]
    if not (SRC / f"{k}.html").exists():
        print("skip", k); continue
    css = read("core.css") + "\n" + read("widgets.css") + "\n" + read(f"{k}.css")
    parts = sorted(SRC.glob(f"{k}_*.js"))
    js = read("core.js") + "\n" + "\n".join(p.read_text(encoding="utf-8") for p in parts) + "\nbootCore();\n"
    html = (shell.replace("{{TITLE}}", b["title"]).replace("{{DESC}}", b["desc"])
            .replace("{{CSS}}", css).replace("{{DEFS}}", read("defs.html"))
            .replace("{{BODY}}", read(f"{k}.html")).replace("{{JS}}", js))
    (Path(__file__).parent / b["out"]).write_text(html, encoding="utf-8")
    print(f"wrote {b['out']}  ({len(html)//1024} KB)")
