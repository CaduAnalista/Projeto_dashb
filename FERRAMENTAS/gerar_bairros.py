# Gera JAVA/bairros-rj.js a partir da malha de bairros do IBGE (Censo 2022):
# um ponto dentro de cada bairro do Rio de Janeiro e de Niterói.
# Uso: python -I gerar_bairros.py <RJ_bairros_CD2022.zip> <saida.js>
import sys, zipfile, struct, json, re, unicodedata, io

def norm(v):
    v = unicodedata.normalize("NFD", str(v or ""))
    v = "".join(c for c in v if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", " ", v.strip().upper())

z = zipfile.ZipFile(sys.argv[1])
nome = lambda ext: next(n for n in z.namelist() if n.lower().endswith(ext))
cpg = z.read(nome(".cpg")).decode().strip() or "utf-8"
print("prj:", z.read(nome(".prj")).decode()[:80], "| cpg:", cpg)

# ---- DBF ----
dbf = z.read(nome(".dbf"))
n_reg, tam_cab, tam_reg = struct.unpack("<IHH", dbf[4:12])
campos, pos = [], 32
while dbf[pos] != 0x0D:
    nm = dbf[pos:pos + 11].split(b"\0")[0].decode()
    campos.append((nm, dbf[pos + 16]))
    pos += 32
print("campos:", [c[0] for c in campos])
registros = []
for i in range(n_reg):
    ini = tam_cab + i * tam_reg + 1
    r, p = {}, ini
    for nm, tam in campos:
        r[nm] = dbf[p:p + tam].decode(cpg if cpg.lower() != "utf-8" else "utf-8", "replace").strip()
        p += tam
    registros.append(r)

# ---- SHP (polígonos) ----
shp = z.read(nome(".shp"))
formas, p = [], 100
while p < len(shp):
    _, tam = struct.unpack(">ii", shp[p:p + 8])
    conteudo = shp[p + 8:p + 8 + tam * 2]
    p += 8 + tam * 2
    tipo = struct.unpack("<i", conteudo[:4])[0]
    if tipo == 0:
        formas.append([]); continue
    n_partes, n_pontos = struct.unpack("<ii", conteudo[36:44])
    partes = struct.unpack("<%di" % n_partes, conteudo[44:44 + 4 * n_partes])
    base = 44 + 4 * n_partes
    pts = [struct.unpack("<2d", conteudo[base + 16 * k: base + 16 * k + 16]) for k in range(n_pontos)]
    aneis = [pts[partes[k]:(partes[k + 1] if k + 1 < n_partes else n_pontos)] for k in range(n_partes)]
    formas.append(aneis)

def area_centro(anel):
    a = cx = cy = 0.0
    for (x1, y1), (x2, y2) in zip(anel, anel[1:] + anel[:1]):
        f = x1 * y2 - x2 * y1
        a += f; cx += (x1 + x2) * f; cy += (y1 + y2) * f
    a /= 2
    return (a, cx / (6 * a), cy / (6 * a)) if a else (0, anel[0][0], anel[0][1])

def dentro(x, y, aneis):
    d = False
    for anel in aneis:
        for (x1, y1), (x2, y2) in zip(anel, anel[1:] + anel[:1]):
            if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
                d = not d
    return d

def ponto_interno(aneis):
    """centroide do maior anel; se cair fora (bairro em forma de U), usa o meio
       do maior trecho interno da linha horizontal que passa pelo centroide."""
    maior = max(aneis, key=lambda a: abs(area_centro(a)[0]))
    _, cx, cy = area_centro(maior)
    if dentro(cx, cy, aneis):
        return cx, cy
    ys = sorted(y for _, y in maior)
    melhor = None
    for frac in (0.5, 0.4, 0.6, 0.3, 0.7, 0.2, 0.8):
        y = ys[0] + (ys[-1] - ys[0]) * frac if frac != 0.5 else cy
        xs = []
        for anel in aneis:
            for (x1, y1), (x2, y2) in zip(anel, anel[1:] + anel[:1]):
                if (y1 > y) != (y2 > y):
                    xs.append((x2 - x1) * (y - y1) / (y2 - y1) + x1)
        xs.sort()
        for a, b in zip(xs[0::2], xs[1::2]):
            if melhor is None or b - a > melhor[0]:
                melhor = (b - a, (a + b) / 2, y)
        if melhor:
            break
    return melhor[1], melhor[2]

campo_mun = next(c for c, _ in campos if c.upper().startswith("NM_MUN"))
campo_bai = next(c for c, _ in campos if c.upper().startswith("NM_BAIRRO"))
saida = {"RIO DE JANEIRO": {}, "NITEROI": {}}
for r, aneis in zip(registros, formas):
    cidade = norm(r[campo_mun])
    if cidade not in saida or not aneis:
        continue
    x, y = ponto_interno(aneis)
    saida[cidade][norm(r[campo_bai])] = [round(y, 5), round(x, 5)]

for c, d in saida.items():
    print(c, len(d), "bairros")
    print("; ".join(sorted(d)))

js = (
    "/* NEXUS — posição dos bairros do Rio de Janeiro e de Niterói\n"
    "   Um ponto dentro de cada bairro [latitude, longitude], calculado a partir da\n"
    "   malha oficial de bairros do IBGE (Censo 2022, RJ_bairros_CD2022).\n"
    "   Gerado uma vez; o site não acessa a internet para isso.\n"
    "   Os nomes estão sem acento e em maiúsculas (mesma regra de norm() no saude-social.js). */\n"
    "window.BAIRROS_RJ = " + json.dumps(saida, ensure_ascii=False, separators=(",", ":"))
    .replace('},"', '},\n"').replace('{"RIO', '{\n"RIO') + ";\n"
)
with io.open(sys.argv[2], "w", encoding="utf-8") as f:
    f.write(js)
print("gravado:", sys.argv[2], len(js.encode()), "bytes")
