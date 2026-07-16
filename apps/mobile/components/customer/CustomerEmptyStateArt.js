import React from "react";
import Svg, { Circle, Defs, G, LinearGradient, Path, RadialGradient, Rect, Stop, Text as SvgText } from "react-native-svg";

const BLUE = "#075BD8";
const BLUE_DARK = "#063D91";
const PAPER = "#D8DBDF";
const STAR = "#506078";

function Diamond({ x, y, size = 4, opacity = 0.72 }) {
  return <Path d={`M${x} ${y-size}L${x+size} ${y}L${x} ${y+size}L${x-size} ${y}Z`} fill="none" stroke={STAR} strokeWidth="1.2" opacity={opacity} />;
}

function Decorations() {
  return (
    <G>
      <Diamond x={39} y={20} />
      <Diamond x={200} y={16} opacity={0.64} />
      <Circle cx={16} cy={63} r={2.2} fill={STAR} opacity={0.68} />
      <Circle cx={219} cy={62} r={2.2} fill={STAR} opacity={0.68} />
      <Diamond x={11} y={116} size={4.2} opacity={0.68} />
      <Path d="M211 108L212.6 111.4L216 113L212.6 114.6L211 118L209.4 114.6L206 113L209.4 111.4Z" fill={STAR} opacity={0.48} />
      <Circle cx={42} cy={147} r={2.3} fill={BLUE_DARK} opacity={0.52} />
    </G>
  );
}

function ArtworkDefs() {
  return (
    <Defs>
      <RadialGradient id="halo" cx="50%" cy="42%" rx="54%" ry="56%">
        <Stop offset="0" stopColor="#132845" stopOpacity="0.9" />
        <Stop offset="0.72" stopColor="#0A1A31" stopOpacity="0.92" />
        <Stop offset="1" stopColor="#061326" stopOpacity="0.18" />
      </RadialGradient>
      <LinearGradient id="paper" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0" stopColor="#EEF0F2" /><Stop offset="0.62" stopColor={PAPER} /><Stop offset="1" stopColor="#C8CDD3" />
      </LinearGradient>
      <LinearGradient id="folder" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0" stopColor="#34445B" /><Stop offset="0.55" stopColor="#223249" /><Stop offset="1" stopColor="#142238" />
      </LinearGradient>
      <LinearGradient id="calendar" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor="#F1F2F3" /><Stop offset="1" stopColor="#D6D9DD" />
      </LinearGradient>
      <LinearGradient id="badge" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0" stopColor="#0872F2" /><Stop offset="1" stopColor="#034BB8" />
      </LinearGradient>
    </Defs>
  );
}

export function InvoiceEmptyArt() {
  return (
    <Svg width={230} height={170} viewBox="0 0 230 170" accessibilityLabel="Empty invoice folder illustration">
      <ArtworkDefs /><Decorations /><Circle cx={115} cy={80} r={76} fill="url(#halo)" />
      <Rect x={61} y={73} width={49} height={22} rx={8} fill="#435168" opacity={0.72} />
      <Path d="M75 36Q75 31 81 31H143L160 48V115H75Z" fill="#020814" opacity={0.42} />
      <Path d="M76 32Q76 27 82 27H143L160 44V112H76Z" fill="url(#paper)" />
      <Path d="M143 27L160 44H148Q143 44 143 39Z" fill="#BCC2CA" />
      <SvgText x={88} y={49} fill="#7C8795" fontSize={10} fontWeight="600" letterSpacing={0.4}>INVOICE</SvgText>
      <Path d="M89 62H139M89 74H126M89 86H142" stroke="#A4ABB4" strokeWidth={4} strokeLinecap="round" opacity={0.46} />
      <Path d="M55 92Q55 86 62 86H104L115 95H164Q171 95 170 103L166 149Q165 158 156 158H66Q57 158 56 149Z" fill="#020814" opacity={0.42} />
      <Path d="M55 88Q55 82 62 82H104L115 91H164Q171 91 170 99L166 145Q165 154 156 154H66Q57 154 56 145Z" fill="url(#folder)" />
      <Path d="M71 91V123" stroke="#A8B2C0" strokeWidth={1} opacity={0.78} />
      <Circle cx={174} cy={134} r={27} fill="#020A18" opacity={0.55} />
      <Circle cx={174} cy={130} r={23} fill="url(#badge)" />
      <Path d="M166 122L182 138M182 122L166 138" stroke="#FFFFFF" strokeWidth={3.2} strokeLinecap="round" />
    </Svg>
  );
}

export function ScheduleEmptyArt() {
  const cells = [[74,78],[97,78],[120,78],[143,78],[74,101],[97,101],[120,101],[143,101],[74,124],[97,124],[120,124]];
  return (
    <Svg width={230} height={170} viewBox="0 0 230 170" accessibilityLabel="Empty trip schedule calendar illustration">
      <ArtworkDefs /><Decorations /><Circle cx={115} cy={80} r={76} fill="url(#halo)" />
      <Rect x={61} y={47} width={109} height={109} rx={11} fill="#020814" opacity={0.4} />
      <Rect x={61} y={43} width={109} height={109} rx={11} fill="url(#calendar)" />
      <Path d="M61 54Q61 43 72 43H159Q170 43 170 54V67H61Z" fill="#536278" />
      <Path d="M61 67H170" stroke="#AEB5BE" strokeWidth={1} opacity={0.5} />
      <Rect x={82} y={36} width={6} height={24} rx={3} fill="#020814" opacity={0.44} />
      <Rect x={82} y={33} width={5} height={22} rx={2.5} fill="#929BA8" />
      <Rect x={143} y={36} width={6} height={24} rx={3} fill="#020814" opacity={0.44} />
      <Rect x={143} y={33} width={5} height={22} rx={2.5} fill="#929BA8" />
      {cells.map(([x,y], index) => <Rect key={`${x}-${y}`} x={x} y={y} width={14} height={14} rx={2.5} fill={index%3===1 ? "#AFB5BD" : "#BBC0C7"} />)}
      <Circle cx={170} cy={132} r={31} fill="#020A18" opacity={0.55} />
      <Circle cx={170} cy={128} r={27} fill={PAPER} stroke={BLUE_DARK} strokeWidth={5} />
      <Path d="M170 113V129L181 137" fill="none" stroke={BLUE_DARK} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
