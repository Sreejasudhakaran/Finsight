import { useEffect, useRef } from "react";
import * as d3 from "d3";

export default function RiskChart({ data = [], ticker = "AAPL" }) {
  const svgRef = useRef(null);

  useEffect(() => {
    if (!data.length || !svgRef.current) return;

    const margin = { top: 10, right: 20, bottom: 30, left: 50 };
    const W = svgRef.current.clientWidth || 500;
    const H = 200;
    const w = W - margin.left - margin.right;
    const h = H - margin.top  - margin.bottom;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("viewBox", `0 0 ${W} ${H}`);

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const parseDate = d3.timeParse("%Y-%m-%d");
    const parsed = data.map(d => ({ date: parseDate(d.date), close: d.close })).filter(d => d.date);

    const xScale = d3.scaleTime().domain(d3.extent(parsed, d => d.date)).range([0, w]);
    const yScale = d3.scaleLinear().domain([d3.min(parsed, d => d.close) * 0.98, d3.max(parsed, d => d.close) * 1.02]).range([h, 0]);

    // Gradient
    const defs = svg.append("defs");
    const grad = defs.append("linearGradient").attr("id", "lineGrad").attr("x1","0").attr("y1","0").attr("x2","0").attr("y2","1");
    grad.append("stop").attr("offset","0%").attr("stop-color","#3b82f6").attr("stop-opacity","0.3");
    grad.append("stop").attr("offset","100%").attr("stop-color","#3b82f6").attr("stop-opacity","0");

    // Area
    const area = d3.area().x(d => xScale(d.date)).y0(h).y1(d => yScale(d.close)).curve(d3.curveCatmullRom);
    g.append("path").datum(parsed).attr("fill","url(#lineGrad)").attr("d", area);

    // Line
    const line = d3.line().x(d => xScale(d.date)).y(d => yScale(d.close)).curve(d3.curveCatmullRom);
    g.append("path").datum(parsed).attr("fill","none").attr("stroke","#3b82f6").attr("stroke-width","1.5").attr("d", line);

    // X axis
    g.append("g").attr("transform", `translate(0,${h})`).call(
      d3.axisBottom(xScale).ticks(5).tickFormat(d3.timeFormat("%b %d"))
    ).call(ax => {
      ax.select(".domain").remove();
      ax.selectAll("line").attr("stroke","rgba(255,255,255,0.08)");
      ax.selectAll("text").attr("fill","#475569").attr("font-size","11px").attr("font-family","DM Sans");
    });

    // Y axis
    g.append("g").call(
      d3.axisLeft(yScale).ticks(4).tickFormat(d => `$${d.toFixed(0)}`)
    ).call(ax => {
      ax.select(".domain").remove();
      ax.selectAll("line").attr("stroke","rgba(255,255,255,0.08)");
      ax.selectAll("text").attr("fill","#475569").attr("font-size","11px").attr("font-family","DM Sans");
    });

    // Hover crosshair
    const tooltip = g.append("g").style("display","none");
    tooltip.append("line").attr("class","cross-v").attr("stroke","rgba(255,255,255,0.15)").attr("stroke-dasharray","3").attr("y1",0).attr("y2",h);
    tooltip.append("circle").attr("r",4).attr("fill","#3b82f6").attr("stroke","white").attr("stroke-width","1.5");
    tooltip.append("rect").attr("x",8).attr("y",-18).attr("width",80).attr("height",20).attr("rx","4").attr("fill","rgba(10,18,37,0.9)").attr("stroke","rgba(255,255,255,0.1)").attr("stroke-width","0.5");
    const tooltipText = tooltip.append("text").attr("x",48).attr("y",-4).attr("text-anchor","middle").attr("fill","#f1f5f9").attr("font-size","11px").attr("font-family","DM Sans");

    svg.append("rect").attr("width",W).attr("height",H).attr("fill","none").attr("pointer-events","all")
      .on("mousemove", function(event) {
        const [mx] = d3.pointer(event, g.node());
        const bisect = d3.bisector(d => d.date).left;
        const x0 = xScale.invert(mx);
        const i  = bisect(parsed, x0, 1);
        const d  = parsed[Math.min(i, parsed.length-1)];
        if (!d) return;
        tooltip.style("display", null).attr("transform", `translate(${xScale(d.date)},${yScale(d.close)})`);
        tooltip.select(".cross-v").attr("y1", -yScale(d.close)).attr("y2", h - yScale(d.close));
        tooltipText.text(`$${d.close.toFixed(2)}`);
      })
      .on("mouseleave", () => tooltip.style("display","none"));

  }, [data, ticker]);

  return <svg ref={svgRef} className="chart-svg" style={{ height: 200 }} />;
}
