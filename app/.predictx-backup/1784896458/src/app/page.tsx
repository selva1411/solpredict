"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Bolt, Layers, Shield } from "lucide-react";

export default function LandingPage() {
  useEffect(() => {
    const canvas = document.getElementById("bg-canvas") as HTMLCanvasElement;
    if (!canvas) return;
    const gl = canvas.getContext("webgl");
    if (!gl) return;
    const vs = `attribute vec2 p;varying vec2 t;void main(){t=p*0.5+0.5;t.y=1.0-t.y;gl_Position=vec4(p,0.0,1.0);}`;
    const fs = `precision highp float;varying vec2 t;uniform float u;vec3 m(vec3 x){return x-floor(x*(1./289.))*289.;}float n(vec2 v){const vec4 C=vec4(.211324865405187,.366025403784439,-.577350269189626,.024390243902439);vec2 i=floor(v+dot(v,C.yy));vec2 x0=v-i+dot(i,C.xx);vec2 i1=(x0.x>x0.y)?vec2(1.,0.):vec2(0.,1.);vec4 x12=x0.xyxy+C.xxzz;x12.xy-=i1;i=m(i);vec3 p=m(m(i.y+vec3(0.,i1.y,1.))+i.x+vec3(0.,i1.x,1.));vec3 a=max(.5-vec3(dot(x0,x0),dot(x12.xy,x12.xy),dot(x12.zw,x12.zw)),0.);a=a*a;a=a*a;vec3 x=2.*fract(p*C.www)-1.;vec3 h=abs(x)-.5;vec3 o=x-floor(x+.5);vec3 g=o*vec3(a.x,a.y,a.z);return 130.*dot(a,g);}void main(){float s=n(t*3.+u*.05);vec3 c1=vec3(.05,.05,.05);vec3 c2=vec3(.6,.27,1.);float msk=smoothstep(.3,.7,s);vec3 fc=mix(c1,c2*.1,msk);float p=.5+.5*sin(u*.3);fc+=vec3(.07,1.,.85)*.015*(1.-t.y)*p;gl_FragColor=vec4(fc,1.);}`;
    const cs = (t: number, s: string) => { const sh = gl.createShader(t)!; gl.shaderSource(sh, s); gl.compileShader(sh); return sh; };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, cs(gl.VERTEX_SHADER, vs));
    gl.attachShader(prog, cs(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(prog);
    gl.useProgram(prog);
    const buf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const pos = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);
    const ut = gl.getUniformLocation(prog, "u");
    const r = (t: number) => {
      canvas.width = innerWidth;
      canvas.height = innerHeight;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform1f(ut, t * 0.001);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      requestAnimationFrame(r);
    };
    const id = requestAnimationFrame(r);
    return () => cancelAnimationFrame(id);
  }, []);
  return (
    <div className="min-h-screen font-inter animate-fade-in">
      {/* WebGL Canvas Background */}
      <canvas id="bg-canvas" className="fixed top-0 left-0 w-screen h-screen -z-10 pointer-events-none" suppressHydrationWarning />

      {/* Side Navigation Bar */}
      <aside className="fixed left-0 top-0 h-screen w-64 bg-[rgba(10,10,10,0.6)] backdrop-blur-[20px] border-r border-white/10 z-[60] hidden lg:flex flex-col px-4 py-6 shadow-[0_0_15px_rgba(153,69,255,0.1)]">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-10 h-10 rounded bg-gradient-to-r from-[#9945FF] to-[#00ec91] flex items-center justify-center">
            <span className="text-white font-bold text-lg">S</span>
          </div>
          <div>
            <h1 className="text-2xl tracking-tighter text-[#d8b9ff] font-bold">SolPredict</h1>
            <p className="font-mono text-[10px] text-[#cec2d8]">Terminal v1.0.4</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1">
          <a className="flex items-center gap-3 px-4 py-3 text-[#d8b9ff] border-r-2 border-[#d8b9ff] bg-[rgba(153,69,255,0.05)] transition-all" href="/markets">
            <span className="text-lg">📊</span>
            <span className="font-mono text-sm">Markets</span>
          </a>
          <a className="flex items-center gap-3 px-4 py-3 text-[#cec2d8] hover:text-white hover:bg-white/5 transition-all" href="/portfolio">
            <span className="text-lg">💼</span>
            <span className="font-mono text-sm">Portfolio</span>
          </a>
          <a className="flex items-center gap-3 px-4 py-3 text-[#cec2d8] hover:text-white hover:bg-white/5 transition-all" href="/leaderboard">
            <span className="text-lg">🏆</span>
            <span className="font-mono text-sm">Leaderboard</span>
          </a>
          <a className="flex items-center gap-3 px-4 py-3 text-[#cec2d8] hover:text-white hover:bg-white/5 transition-all" href="/admin">
            <span className="text-lg">⚙️</span>
            <span className="font-mono text-sm">Admin</span>
          </a>
        </nav>
        <div className="mt-auto space-y-4 pt-6 border-t border-white/5">
          <div className="flex flex-col gap-2">
            <a className="flex items-center gap-2 text-[#cec2d8] hover:text-white text-sm px-2" href="#">
              <span className="text-sm">📄</span>
              <span className="font-mono text-xs">Docs</span>
            </a>
            <a className="flex items-center gap-2 text-[#cec2d8] hover:text-white text-sm px-2" href="#">
              <span className="text-sm">❓</span>
              <span className="font-mono text-xs">Support</span>
            </a>
          </div>
        </div>
      </aside>

      {/* Top Navigation Bar */}
      <nav className="fixed top-0 right-0 left-0 lg:left-64 h-16 z-50 bg-[rgba(10,10,10,0.6)] backdrop-blur-[60px] border-b border-white/5 flex justify-between items-center px-6">
        <div className="flex items-center gap-6">
          <div className="hidden md:flex items-center gap-6">
            <a className="text-[#d8b9ff] font-bold font-mono text-[11px] uppercase tracking-[0.12em] border-b border-[#d8b9ff] h-16 flex items-center" href="/markets">Markets</a>
            <a className="text-[#cec2d8] hover:text-[#d8b9ff] transition-colors font-mono text-[11px] uppercase tracking-[0.12em] h-16 flex items-center" href="/portfolio">Portfolio</a>
            <a className="text-[#cec2d8] hover:text-[#d8b9ff] transition-colors font-mono text-[11px] uppercase tracking-[0.12em] h-16 flex items-center" href="/leaderboard">Leaderboard</a>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center bg-[#2a2a2a] px-3 py-1.5 rounded border border-[#4c4355]">
            <span className="text-[#56ffa8] text-[11px] font-mono mr-2">◆</span>
            <span className="font-mono text-xs text-[#e5e2e1]">0.00 SOL</span>
          </div>
          <button className="p-2 text-[#cec2d8] hover:text-[#d8b9ff] transition-colors">🔔</button>
          <button className="p-2 text-[#cec2d8] hover:text-[#d8b9ff] transition-colors">⚙️</button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="lg:ml-64 pt-16 min-h-screen">
        {/* Hero Section */}
        <section className="relative px-6 py-20 md:py-32 container mx-auto max-w-7xl overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left Content */}
            <div className="lg:col-span-7 space-y-8">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-[rgba(216,185,255,0.1)] border border-[rgba(216,185,255,0.2)] rounded-full">
                <span className="flex h-1.5 w-1.5 rounded-full bg-[#d8b9ff] animate-pulse" />
                <span className="text-[#d8b9ff] font-mono text-[10px] uppercase tracking-widest">Mainnet-Beta Live</span>
              </div>
              <h1 className="text-[56px] md:text-[80px] leading-[0.95] font-extrabold tracking-tighter text-[#e5e2e1]">
                Predicting <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#9945FF] to-[#00ec91]">Boundless.</span>
              </h1>
              <p className="text-lg text-[#cec2d8] max-w-xl leading-relaxed">
                High-performance prediction markets on Solana. Trade outcomes with institutional liquidity and sub-second settlement.
              </p>
              <div className="flex flex-wrap gap-4 pt-4">
                <Link href="/markets" className="bg-[#9945ff] text-white px-8 py-4 rounded font-bold flex items-center gap-2 hover:-translate-y-0.5 transition-all shadow-[0_0_30px_rgba(153,69,255,0.2)]">
                  Enter App
                  <ArrowRight className="w-5 h-5" />
                </Link>
                <Link href="/docs/overview" className="bg-transparent border border-[#4c4355] text-[#e5e2e1] px-8 py-4 rounded font-bold hover:bg-[#2a2a2a] transition-all">
                  View Documentation
                </Link>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-8 pt-12 border-t border-[rgba(76,67,85,0.2)]">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.12em] text-[rgba(206,194,216,0.6)] mb-1 font-bold">Total Value Locked</p>
                  <p className="font-mono text-xl font-bold text-[#d8b9ff]">$42.8M</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.12em] text-[rgba(206,194,216,0.6)] mb-1 font-bold">24H Volume</p>
                  <p className="font-mono text-xl font-bold text-[#56ffa8]">$12.4M</p>
                </div>
                <div className="hidden sm:block">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-[rgba(206,194,216,0.6)] mb-1 font-bold">Avg Settlement</p>
                  <p className="font-mono text-xl font-bold text-[#c0c7d6]">0.4s</p>
                </div>
              </div>
            </div>
            {/* Right Visual Card */}
            <div className="lg:col-span-5 relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-[#9945ff] to-[#56ffa8] rounded blur opacity-25 group-hover:opacity-40 transition duration-1000" />
              <div className="bg-[rgba(20,19,19,0.4)] backdrop-blur-[24px] relative rounded border border-[rgba(151,141,161,0.1)] p-6 shadow-2xl overflow-hidden">
                <div className="flex justify-between items-start mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full overflow-hidden border border-[rgba(76,67,85,0.3)] bg-[#9945ff]/20 flex items-center justify-center text-[#d8b9ff] font-bold text-xl">
                      ◎
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-[#e5e2e1]">Crypto Markets</h3>
                      <p className="font-mono text-[11px] text-[#cec2d8] uppercase">Expires Dec 31, 2024</p>
                    </div>
                  </div>
                  <span className="text-[#d8b9ff]">✓</span>
                </div>
                <h2 className="text-xl font-bold mb-8 text-[#e5e2e1]">Will SOL hit $250 by EOY?</h2>
                <div className="space-y-4 mb-8">
                  <div className="relative h-14 bg-[#2a2a2a] rounded border border-[rgba(76,67,85,0.2)] overflow-hidden cursor-pointer hover:border-[#56ffa8] transition-colors">
                    <div className="absolute inset-y-0 left-0 bg-[rgba(86,255,168,0.1)] w-[64%]" />
                    <div className="relative h-full flex justify-between items-center px-4">
                      <span className="flex items-center gap-3">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#56ffa8] shadow-[0_0_8px_rgba(86,255,168,0.5)]" />
                        Yes
                      </span>
                      <span className="font-mono text-lg text-[#56ffa8]">64¢</span>
                    </div>
                  </div>
                  <div className="relative h-14 bg-[#2a2a2a] rounded border border-[rgba(76,67,85,0.2)] overflow-hidden cursor-pointer hover:border-[#ffb4ab] transition-colors">
                    <div className="absolute inset-y-0 left-0 bg-[rgba(255,180,171,0.1)] w-[36%]" />
                    <div className="relative h-full flex justify-between items-center px-4">
                      <span className="flex items-center gap-3">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#ffb4ab] shadow-[0_0_8px_rgba(255,180,171,0.5)]" />
                        No
                      </span>
                      <span className="font-mono text-lg text-[#ffb4ab]">36¢</span>
                    </div>
                  </div>
                </div>
                <div className="flex justify-between items-center text-[11px] font-mono text-[#cec2d8] border-t border-[rgba(76,67,85,0.1)] pt-4 uppercase">
                  <span>$1.2M Vol</span>
                  <div className="flex items-center gap-1">
                    <span>📈</span>
                    <span className="text-[#56ffa8]">+4.2% (24h)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Bento Grid Section */}
        <section className="py-24 px-6 relative z-10">
          <div className="container mx-auto max-w-7xl">
            <div className="text-center mb-16">
              <h2 className="text-4xl mb-4 font-extrabold text-[#e5e2e1] tracking-tighter">Engineered for Performance</h2>
              <p className="text-[#cec2d8] max-w-2xl mx-auto">Centralized exchange precision, decentralized security.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-[rgba(20,19,19,0.4)] backdrop-blur-[24px] border border-[rgba(151,141,161,0.1)] p-8 rounded hover:-translate-y-1 transition-transform">
                <div className="w-12 h-12 rounded bg-[rgba(216,185,255,0.1)] flex items-center justify-center mb-6 border border-[rgba(216,185,255,0.2)]">
                  <Bolt className="text-[#d8b9ff] w-6 h-6" />
                </div>
                <h3 className="text-xl mb-4 text-[#e5e2e1]">Built for Speed</h3>
                <p className="text-[#cec2d8] leading-relaxed mb-6">Solana&apos;s 65k+ TPS provides sub-second trade execution. Low latency is no longer a luxury&mdash;it&apos;s the standard.</p>
                <div className="flex items-center gap-2 text-[#56ffa8] font-mono text-xs">
                  <span>⚡</span> Latency: 45ms
                </div>
              </div>
              <div className="bg-[rgba(20,19,19,0.4)] backdrop-blur-[24px] border border-[rgba(153,69,255,0.2)] bg-[rgba(153,69,255,0.03)] p-8 rounded hover:-translate-y-1 transition-transform">
                <div className="w-12 h-12 rounded bg-[rgba(216,185,255,0.2)] flex items-center justify-center mb-6 border border-[rgba(216,185,255,0.3)]">
                  <Layers className="text-[#d8b9ff] w-6 h-6" />
                </div>
                <h3 className="text-xl mb-4 text-[#e5e2e1]">Deep Liquidity</h3>
                <p className="text-[#cec2d8] leading-relaxed mb-6">Our CLOB model enables institutional-grade size to move through markets with minimal slippage.</p>
                <div className="bg-[rgba(53,52,52,0.5)] rounded p-4 border border-white/5">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] font-mono text-[#cec2d8]">DEPTH</span>
                    <span className="text-[10px] font-mono text-[#56ffa8]">LIVE</span>
                  </div>
                  <div className="flex gap-1.5 h-1.5">
                    <div className="flex-1 bg-[rgba(86,255,168,0.2)] rounded-full" />
                    <div className="flex-1 bg-[rgba(86,255,168,0.4)] rounded-full" />
                    <div className="flex-1 bg-[rgba(86,255,168,0.6)] rounded-full" />
                    <div className="flex-1 bg-[rgba(86,255,168,0.8)] rounded-full" />
                    <div className="flex-1 bg-[#56ffa8] rounded-full shadow-[0_0_5px_#56ffa8]" />
                  </div>
                </div>
              </div>
              <div className="bg-[rgba(20,19,19,0.4)] backdrop-blur-[24px] border border-[rgba(151,141,161,0.1)] p-8 rounded hover:-translate-y-1 transition-transform">
                <div className="w-12 h-12 rounded bg-[rgba(216,185,255,0.1)] flex items-center justify-center mb-6 border border-[rgba(216,185,255,0.2)]">
                  <Shield className="text-[#d8b9ff] w-6 h-6" />
                </div>
                <h3 className="text-xl mb-4 text-[#e5e2e1]">Trustless Settlement</h3>
                <p className="text-[#cec2d8] leading-relaxed mb-6">Objective outcomes verified by decentralized oracle networks. Transparent, immutable, and autonomous.</p>
                <div className="flex items-center gap-2 text-[#d8b9ff] font-mono text-xs">
                  <span>🔒</span> Fully Audited
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-24 px-6">
          <div className="max-w-4xl mx-auto bg-[rgba(20,19,19,0.4)] backdrop-blur-[24px] border border-[rgba(151,141,161,0.1)] p-16 rounded-xl relative overflow-hidden text-center">
            <div className="absolute inset-0 bg-[rgba(153,69,255,0.03)]" />
            <h2 className="text-5xl mb-6 font-extrabold text-[#e5e2e1] relative z-10 tracking-tight">Ready to outsmart the market?</h2>
            <p className="text-xl text-[#cec2d8] mb-12 relative z-10 max-w-2xl mx-auto">Join the fastest-growing forecasting platform on Solana today.</p>
            <div className="flex flex-col sm:flex-row justify-center gap-6 relative z-10">
              <Link href="/markets" className="bg-[#9945ff] text-white px-10 py-5 rounded font-bold shadow-2xl shadow-[0_0_30px_rgba(153,69,255,0.2)] hover:scale-105 transition-transform">
                Launch Application
              </Link>
              <a href="#" className="bg-[#2a2a2a] text-[#e5e2e1] px-10 py-5 rounded font-bold border border-[rgba(76,67,85,0.3)] hover:bg-[#353434] transition-colors">
                Connect Wallet
              </a>
            </div>
          </div>
        </section>
      </main>

      {/* Footer System Bar */}
      <footer className="h-8 fixed bottom-0 right-0 left-0 lg:left-64 bg-[#0e0e0e] border-t border-white/5 flex items-center justify-between px-4 z-50">
        <div className="flex items-center gap-4">
          <span className="font-mono text-[10px] text-[#56ffa8] uppercase tracking-widest">Mainnet-Beta: Operational</span>
        </div>
        <div className="flex gap-6 items-center">
          <span className="font-mono text-[10px] text-[#cec2d8] uppercase">Gas: 0.000005 SOL</span>
          <span className="font-mono text-[10px] text-[#cec2d8] uppercase">Latency: 14ms</span>
          <span className="font-mono text-[10px] text-[#cec2d8] uppercase">Epoch: 542</span>
        </div>
      </footer>
    </div>
  );
}
