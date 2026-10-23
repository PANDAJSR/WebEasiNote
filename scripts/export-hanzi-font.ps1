param([string]$FontPath, [string]$CharactersFile, [string]$OutputPath)
$ErrorActionPreference = 'Stop'
Add-Type -Path "$env:WINDIR\Microsoft.NET\Framework64\v4.0.30319\System.Drawing.dll"
# Only system GDI+ reads the selected font. No EasiNote assembly is executed.
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System;
using System.IO;
using System.Globalization;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Text;
public static class HanziFontExport {
  public static void Run(string font, string characters, string output) {
    using (var fonts = new PrivateFontCollection())
    using (var writer = new StreamWriter(output, false, new System.Text.UTF8Encoding(false))) {
      fonts.AddFontFile(font);
      foreach (char ch in File.ReadAllText(characters)) {
        using (var path = new GraphicsPath())
        using (var part = new GraphicsPath()) {
          path.AddString(ch.ToString(), fonts.Families[0], 0, 300f, PointF.Empty, null);
          using (var iterator = new GraphicsPathIterator(path)) {
            writer.Write("[" + (int)ch + ",[");
            for (int i = 0; i < iterator.SubpathCount; i++) {
              bool closed;
              iterator.NextSubpath(part, out closed);
              if (i > 0) writer.Write(",");
              writer.Write("\"");
              var points = part.PathPoints;
              for (int j = 0; j < points.Length; j++) {
                writer.Write(j == 0 ? "M" : "L");
                writer.Write((points[j].X - 45f).ToString("0.####", CultureInfo.InvariantCulture));
                writer.Write(",");
                writer.Write(points[j].Y.ToString("0.####", CultureInfo.InvariantCulture));
              }
              writer.Write("Z\"");
            }
            writer.WriteLine("]]");
          }
        }
      }
    }
  }
}
'@
[HanziFontExport]::Run($FontPath, $CharactersFile, $OutputPath)
