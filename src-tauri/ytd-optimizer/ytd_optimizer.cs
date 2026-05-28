using System;
using System.IO;
using System.Diagnostics;
using System.Collections.Generic;
using CodeWalker.GameFiles;

namespace YtdOptimizer
{
    class Program
    {
        static int Main(string[] args)
        {
            if (args.Length < 3)
            {
                Console.WriteLine("Usage: ytd-optimizer.exe <inputPath> <maxSize> <texconvPath>");
                return 1;
            }

            string inputPath = args[0];
            int maxSize = int.Parse(args[1]);
            string texconvPath = args[2];

            if (!File.Exists(texconvPath))
            {
                Console.WriteLine("Error: texconv.exe not found at " + texconvPath);
                return 1;
            }

            // Create temp directory for texture processing
            string tempDir = Path.Combine(Path.GetTempPath(), "ytd_opt_" + Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(tempDir);

            try
            {
                List<string> filesToProcess = new List<string>();
                if (Directory.Exists(inputPath))
                {
                    filesToProcess.AddRange(Directory.GetFiles(inputPath, "*.ytd", SearchOption.AllDirectories));
                }
                else if (File.Exists(inputPath) && inputPath.EndsWith(".ytd", StringComparison.OrdinalIgnoreCase))
                {
                    filesToProcess.Add(inputPath);
                }

                Console.WriteLine("Found " + filesToProcess.Count + " YTD files to process.");

                foreach (string ytdPath in filesToProcess)
                {
                    Console.WriteLine("Processing: " + Path.GetFileName(ytdPath));
                    OptimizeYtd(ytdPath, maxSize, texconvPath, tempDir);
                }

                Console.WriteLine("Optimization completed successfully.");
                return 0;
            }
            catch (Exception ex)
            {
                Console.WriteLine("Error: " + ex.Message);
                return 1;
            }
            finally
            {
                try
                {
                    if (Directory.Exists(tempDir))
                    {
                        Directory.Delete(tempDir, true);
                    }
                }
                catch { }
            }
        }

        static void OptimizeYtd(string ytdPath, int maxSize, string texconvPath, string tempDir)
        {
            byte[] fileData = File.ReadAllBytes(ytdPath);
            YtdFile ytd = new YtdFile();
            ytd.Load(fileData);

            if (ytd.TextureDict == null || ytd.TextureDict.Textures == null)
            {
                Console.WriteLine("  Skipped: Not a valid texture dictionary or empty.");
                return;
            }

            var textures = ytd.TextureDict.Textures;
            bool modified = false;

            for (int i = 0; i < textures.Count; i++)
            {
                var tex = textures[i];
                if (tex.Width > maxSize || tex.Height > maxSize)
                {
                    Console.WriteLine("  Optimizing texture: " + tex.Name + " (" + tex.Width + "x" + tex.Height + ")");
                    
                    try
                    {
                        // 1. Export DDS
                        byte[] ddsBytes = CodeWalker.Utils.DDSIO.GetDDSFile(tex);
                        string tempDdsPath = Path.Combine(tempDir, tex.Name + ".dds");
                        File.WriteAllBytes(tempDdsPath, ddsBytes);

                        // 2. Call texconv.exe to downscale
                        RunTexconv(texconvPath, tempDdsPath, maxSize, tempDir);

                        // 3. Load optimized DDS bytes back
                        if (File.Exists(tempDdsPath))
                        {
                            byte[] optimizedDds = File.ReadAllBytes(tempDdsPath);
                            
                            // Re-import back into Texture object
                            Texture newTex = CodeWalker.Utils.DDSIO.GetTexture(optimizedDds);
                            newTex.Name = tex.Name;
                            newTex.NameHash = tex.NameHash;
                            newTex.Usage = tex.Usage;
                            newTex.UsageFlags = tex.UsageFlags;
                            
                            textures[i] = newTex;
                            modified = true;
                            
                            // Delete temp file
                            File.Delete(tempDdsPath);
                        }
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine("    Failed to optimize texture " + tex.Name + ": " + ex.Message);
                    }
                }
            }

            if (modified)
            {
                byte[] newData = ytd.Save();
                File.WriteAllBytes(ytdPath, newData);
                Console.WriteLine("  Saved optimized YTD: " + Path.GetFileName(ytdPath));
            }
            else
            {
                Console.WriteLine("  No textures exceeded resolution limit.");
            }
        }

        static void RunTexconv(string texconvPath, string ddsPath, int maxSize, string outputDir)
        {
            ProcessStartInfo psi = new ProcessStartInfo();
            psi.FileName = texconvPath;
            psi.Arguments = string.Format("-w {0} -h {0} -y -o \"{1}\" \"{2}\"", maxSize, outputDir, ddsPath);
            psi.CreateNoWindow = true;
            psi.UseShellExecute = false;
            psi.RedirectStandardOutput = true;
            psi.RedirectStandardError = true;

            using (Process p = Process.Start(psi))
            {
                p.WaitForExit();
            }
        }
    }
}
