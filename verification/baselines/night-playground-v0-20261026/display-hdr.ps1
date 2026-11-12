# Read-only Windows display capabilities. Never changes HDR, calibration or power.
# https://learn.microsoft.com/windows/win32/api/dxgi1_6/ns-dxgi1_6-dxgi_output_desc1
# https://learn.microsoft.com/windows/win32/api/wingdi/ns-wingdi-displayconfig_sdr_white_level
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
$source = @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;

public static class NativeDisplayHdr {
  [StructLayout(LayoutKind.Sequential)] public struct Rect { public int left,top,right,bottom; }
  [StructLayout(LayoutKind.Sequential)] struct Luid { public uint LowPart; public int HighPart; }
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)] struct OutputDesc1 {
    [MarshalAs(UnmanagedType.ByValTStr,SizeConst=32)] public string DeviceName;
    public Rect DesktopCoordinates;
    [MarshalAs(UnmanagedType.Bool)] public bool AttachedToDesktop;
    public uint Rotation; public IntPtr Monitor; public uint BitsPerColor,ColorSpace;
    [MarshalAs(UnmanagedType.ByValArray,SizeConst=2)] public float[] RedPrimary;
    [MarshalAs(UnmanagedType.ByValArray,SizeConst=2)] public float[] GreenPrimary;
    [MarshalAs(UnmanagedType.ByValArray,SizeConst=2)] public float[] BluePrimary;
    [MarshalAs(UnmanagedType.ByValArray,SizeConst=2)] public float[] WhitePoint;
    public float MinLuminance,MaxLuminance,MaxFullFrameLuminance;
  }
  [StructLayout(LayoutKind.Sequential)] struct Header { public uint type,size; public Luid adapterId; public uint id; }
  [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)] struct SourceName {
    public Header header; [MarshalAs(UnmanagedType.ByValTStr,SizeConst=32)] public string name;
  }
  [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)] struct TargetName {
    public Header header;public uint flags,technology;public ushort manufactureId,productCodeId;public uint connector;
    [MarshalAs(UnmanagedType.ByValTStr,SizeConst=64)] public string friendlyName;
    [MarshalAs(UnmanagedType.ByValTStr,SizeConst=128)] public string devicePath;
  }
  [StructLayout(LayoutKind.Sequential)] struct WhiteLevel { public Header header;public uint level; }
  [StructLayout(LayoutKind.Sequential)] struct AdvancedColour { public Header header;public uint flags,encoding,bitsPerChannel; }
  [StructLayout(LayoutKind.Sequential)] struct PathSource { public Luid adapterId;public uint id,modeInfoIdx,statusFlags; }
  [StructLayout(LayoutKind.Sequential)] struct Rational { public uint numerator,denominator; }
  [StructLayout(LayoutKind.Sequential)] struct PathTarget { public Luid adapterId;public uint id,modeInfoIdx,technology,rotation,scaling;public Rational refreshRate;public uint scanLineOrdering,targetAvailable,statusFlags; }
  [StructLayout(LayoutKind.Sequential)] struct DisplayPath { public PathSource source;public PathTarget target;public uint flags; }
  [UnmanagedFunctionPointer(CallingConvention.StdCall)] delegate int EnumItem(IntPtr self,uint index,out IntPtr item);
  [UnmanagedFunctionPointer(CallingConvention.StdCall)] delegate int GetDesc1(IntPtr self,out OutputDesc1 desc);
  [DllImport("dxgi.dll")] static extern int CreateDXGIFactory1(ref Guid iid,out IntPtr factory);
  [DllImport("user32.dll")] static extern int GetDisplayConfigBufferSizes(uint flags,out uint paths,out uint modes);
  [DllImport("user32.dll")] static extern int QueryDisplayConfig(uint flags,ref uint paths,IntPtr pathInfo,ref uint modes,IntPtr modeInfo,IntPtr topology);
  [DllImport("user32.dll",EntryPoint="DisplayConfigGetDeviceInfo")] static extern int GetSourceName(ref SourceName info);
  [DllImport("user32.dll",EntryPoint="DisplayConfigGetDeviceInfo")] static extern int GetTargetName(ref TargetName info);
  [DllImport("user32.dll",EntryPoint="DisplayConfigGetDeviceInfo")] static extern int GetWhiteLevel(ref WhiteLevel info);
  [DllImport("user32.dll",EntryPoint="DisplayConfigGetDeviceInfo")] static extern int GetAdvancedColour(ref AdvancedColour info);
  [DllImport("user32.dll")] static extern IntPtr SetThreadDpiAwarenessContext(IntPtr context);
  [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] static extern IntPtr MonitorFromWindow(IntPtr window,uint flags);
  [DllImport("shcore.dll")] static extern int GetScaleFactorForMonitor(IntPtr monitor,out uint scale);

  public class Display {
    public string deviceName,friendlyName,colorSpaceName;
    public Rect bounds;public bool attached;public uint bitsPerColor,colorSpace;
    public double minLuminanceNits,maxLuminanceNits,maxFullFrameLuminanceNits;
    public double[] redPrimary,greenPrimary,bluePrimary,whitePoint;
    public double? sdrWhiteNits,scaleFactor;
    public uint? sdrWhiteLevelRaw;
    public bool? advancedColorSupported,advancedColorEnabled;
    public bool foregroundMonitor;
    public string luminanceSource="DXGI_OUTPUT_DESC1: EDID/driver/calibration report, not a photometer measurement";
  }
  public class Result {
    public bool available;public string platform="win32",source="DXGI Output6 + DisplayConfig (read only)",generatedAt=DateTime.UtcNow.ToString("o");
    public List<Display> displays=new List<Display>();public List<string> errors=new List<string>();
    public string note="Reported peak is a small-area capability; full-frame peak is separate. SDR white is the current Windows setting. No Windows setting was changed.";
  }
  class PathMetadata { public string friendlyName;public double? white;public uint? whiteRaw;public bool? supported,enabled; }
  static Header MakeHeader(uint type,Luid adapter,uint id,Type dataType){return new Header{type=type,size=(uint)Marshal.SizeOf(dataType),adapterId=adapter,id=id};}
  static T Method<T>(IntPtr instance,int index) where T:class {
    return Marshal.GetDelegateForFunctionPointer(Marshal.ReadIntPtr(Marshal.ReadIntPtr(instance),index*IntPtr.Size),typeof(T)) as T;
  }
  static double[] Pair(float[] value){return value==null?null:new double[]{value[0],value[1]};}
  static string ColourSpace(uint value){switch(value){case 0:return "RGB_FULL_G22_NONE_P709";case 1:return "RGB_FULL_G10_NONE_P709";case 12:return "RGB_FULL_G2084_NONE_P2020";case 14:return "RGB_STUDIO_G2084_NONE_P2020";default:return "DXGI_COLOR_SPACE_TYPE_"+value;}}
  static Dictionary<string,PathMetadata> DisplayConfig(Result report){
    var output=new Dictionary<string,PathMetadata>(StringComparer.OrdinalIgnoreCase);
    for(int attempt=0;attempt<3;attempt++){
      uint count,modes;int status=GetDisplayConfigBufferSizes(2,out count,out modes);
      if(status!=0){report.errors.Add("GetDisplayConfigBufferSizes: "+status);return output;}
      if(count>1024||modes>4096){report.errors.Add("Unexpected display topology size.");return output;}
      int pathSize=Marshal.SizeOf(typeof(DisplayPath));
      if(pathSize!=72){report.errors.Add("Unexpected DISPLAYCONFIG_PATH_INFO size: "+pathSize);return output;}
      IntPtr pathBuffer=Marshal.AllocHGlobal((int)Math.Max(1,count)*pathSize),modeBuffer=Marshal.AllocHGlobal((int)Math.Max(1,modes)*64);
      try{
        status=QueryDisplayConfig(2,ref count,pathBuffer,ref modes,modeBuffer,IntPtr.Zero);
        if(status==122)continue;
        if(status!=0){report.errors.Add("QueryDisplayConfig: "+status);return output;}
        for(int i=0;i<count;i++){
          DisplayPath path=(DisplayPath)Marshal.PtrToStructure(IntPtr.Add(pathBuffer,i*pathSize),typeof(DisplayPath));
          SourceName source=new SourceName{header=MakeHeader(1,path.source.adapterId,path.source.id,typeof(SourceName))};
          if(GetSourceName(ref source)!=0||String.IsNullOrEmpty(source.name))continue;
          var data=new PathMetadata();
          TargetName name=new TargetName{header=MakeHeader(2,path.target.adapterId,path.target.id,typeof(TargetName))};
          if(GetTargetName(ref name)==0)data.friendlyName=name.friendlyName;
          WhiteLevel white=new WhiteLevel{header=MakeHeader(11,path.target.adapterId,path.target.id,typeof(WhiteLevel))};
          if(GetWhiteLevel(ref white)==0&&white.level>0){data.whiteRaw=white.level;data.white=white.level*.08;}
          AdvancedColour colour=new AdvancedColour{header=MakeHeader(9,path.target.adapterId,path.target.id,typeof(AdvancedColour))};
          if(GetAdvancedColour(ref colour)==0){data.supported=(colour.flags&1)!=0;data.enabled=(colour.flags&2)!=0;}
          output[source.name]=data;
        }
        return output;
      }finally{Marshal.FreeHGlobal(pathBuffer);Marshal.FreeHGlobal(modeBuffer);}
    }
    report.errors.Add("Display topology changed repeatedly during read.");return output;
  }
  public static Result Probe(){
    var report=new Result();IntPtr factory=IntPtr.Zero,previousDpi=IntPtr.Zero;
    try{
      try{previousDpi=SetThreadDpiAwarenessContext(new IntPtr(-4));}catch(EntryPointNotFoundException){}
      var metadata=DisplayConfig(report);var factoryId=new Guid("770aae78-f26f-4dba-a829-253c83d1b387");
      int status=CreateDXGIFactory1(ref factoryId,out factory);if(status<0)Marshal.ThrowExceptionForHR(status);
      IntPtr foreground=MonitorFromWindow(GetForegroundWindow(),2);
      EnumItem enumAdapters=Method<EnumItem>(factory,12);
      for(uint ai=0;ai<32;ai++){
        IntPtr adapter;status=enumAdapters(factory,ai,out adapter);if(status==unchecked((int)0x887a0002))break;if(status<0){report.errors.Add("EnumAdapters1: "+status);break;}
        try{
          EnumItem enumOutputs=Method<EnumItem>(adapter,7);
          for(uint oi=0;oi<32;oi++){
            IntPtr output;status=enumOutputs(adapter,oi,out output);if(status==unchecked((int)0x887a0002))break;if(status<0){report.errors.Add("EnumOutputs: "+status);break;}
            IntPtr output6=IntPtr.Zero;
            try{
              var iid=new Guid("068346e8-aaec-4b84-add7-137f513f77a1");status=Marshal.QueryInterface(output,ref iid,out output6);
              if(status<0){report.errors.Add("IDXGIOutput6 unavailable: "+status);continue;}
              OutputDesc1 desc;status=Method<GetDesc1>(output6,27)(output6,out desc);if(status<0){report.errors.Add("GetDesc1: "+status);continue;}
              var item=new Display{deviceName=desc.DeviceName,bounds=desc.DesktopCoordinates,attached=desc.AttachedToDesktop,bitsPerColor=desc.BitsPerColor,colorSpace=desc.ColorSpace,colorSpaceName=ColourSpace(desc.ColorSpace),
                minLuminanceNits=desc.MinLuminance,maxLuminanceNits=desc.MaxLuminance,maxFullFrameLuminanceNits=desc.MaxFullFrameLuminance,
                redPrimary=Pair(desc.RedPrimary),greenPrimary=Pair(desc.GreenPrimary),bluePrimary=Pair(desc.BluePrimary),whitePoint=Pair(desc.WhitePoint),foregroundMonitor=foreground==desc.Monitor};
              PathMetadata data;if(metadata.TryGetValue(desc.DeviceName,out data)){item.friendlyName=data.friendlyName;item.sdrWhiteNits=data.white;item.sdrWhiteLevelRaw=data.whiteRaw;item.advancedColorSupported=data.supported;item.advancedColorEnabled=data.enabled;}
              uint scale;if(GetScaleFactorForMonitor(desc.Monitor,out scale)==0&&scale>0)item.scaleFactor=scale/100.0;
              report.displays.Add(item);
            }finally{if(output6!=IntPtr.Zero)Marshal.Release(output6);Marshal.Release(output);}
          }
        }finally{Marshal.Release(adapter);}
      }
      report.available=report.displays.Count>0;
    }catch(Exception error){report.errors.Add(error.GetType().Name+": "+error.Message);}
    finally{if(factory!=IntPtr.Zero)Marshal.Release(factory);if(previousDpi!=IntPtr.Zero)try{SetThreadDpiAwarenessContext(previousDpi);}catch{}}
    return report;
  }
}
'@
try {
  if (-not ('NativeDisplayHdr' -as [type])) { Add-Type -TypeDefinition $source -Language CSharp | Out-Null }
  [NativeDisplayHdr]::Probe() | ConvertTo-Json -Depth 12 -Compress
} catch {
  @{ available=$false; platform='win32'; source='DXGI Output6 + DisplayConfig (read only)'; generatedAt=[DateTime]::UtcNow.ToString('o'); displays=@(); errors=@($_.Exception.Message) } | ConvertTo-Json -Depth 5 -Compress
}
