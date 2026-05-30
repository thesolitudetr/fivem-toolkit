import React, { useState } from 'react';
import { useStore } from '../store';
import { translations } from '../translations';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { 
  Sliders, 
  FolderOpen, 
  Car, 
  Volume2, 
  CheckCircle2, 
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

interface VehicleHandlingPhysics {
  mass: number;
  drag: number;
  downforce_modifier: number;
  percent_submerged: number;
  centre_of_mass_offset: [number, number, number];
  inertia_multiplier: [number, number, number];
  drive_bias_front: number;
  initial_drive_gears: number;
  drive_force: number;
  drive_inertia: number;
  clutch_change_rate_scale_upshift: number;
  clutch_change_rate_scale_downshift: number;
  initial_drive_max_flat_vel: number;
  brake_force: number;
  brake_bias_front: number;
  hand_brake_force: number;
  steering_lock: number;
  traction_curve_max: number;
  traction_curve_min: number;
  traction_curve_lateral: number;
  traction_spring_delta_max: number;
  low_speed_traction_loss_mult: number;
  camber_stiffnesss: number;
  traction_bias_front: number;
  traction_loss_mult: number;
  suspension_force: number;
  suspension_comp_damp: number;
  suspension_rebound_damp: number;
  suspension_upper_limit: number;
  suspension_lower_limit: number;
  suspension_raise: number;
  suspension_bias_front: number;
  anti_roll_bar_force: number;
  anti_roll_bar_bias_front: number;
  roll_centre_height_front: number;
  roll_centre_height_rear: number;
  collision_damage_mult: number;
  weapon_damage_mult: number;
  damage_mult: number;
  engine_damage_mult: number;
  petrol_tank_volume: number;
  oil_volume: number;
  seat_offset_dist_x: number;
  seat_offset_dist_y: number;
  seat_offset_dist_z: number;
  monetary_value: number;
}

interface VehicleConfig {
  model_name: string;
  handling_id: string;
  audio_name_hash: string;
  layout: string;
  physics: VehicleHandlingPhysics | null;
}

const fieldInfos: Record<string, { name: string; desc: { en: string; tr: string } }> = {
  mass: { name: "fMass", desc: { en: "Vehicle Mass (kg): The total weight of the vehicle. Affects collision physics and floating height.", tr: "Araç Kütlesi (kg): Aracın toplam ağırlığı. Çarpışmalarda ve su altı batma oranlarında etkilidir." } },
  drag: { name: "fInitialDragCoeff", desc: { en: "Initial Drag Coefficient: Simulates aerodynamic drag. Higher values limit top speed.", tr: "Hava Direnci Katsayısı: Aracın aerodinamik direncidir. Yüksek değerler son hızı düşürür." } },
  downforce_modifier: { name: "fDownforceModifier", desc: { en: "Downforce Modifier: Increases vertical downforce at high speed to improve cornering grip.", tr: "Yere Basma Gücü Çarpanı: Aracın yüksek hızda yere yapışmasını artırır, yol tutuşunu güçlendirir." } },
  percent_submerged: { name: "fPercentSubmerged", desc: { en: "Percent Submerged: Percentage of vehicle height submerged before it starts to sink in water.", tr: "Suya Batma Oranı (%): Aracın batmadan önce ne kadarının su altında kalacağını belirler." } },
  drive_bias_front: { name: "fDriveBiasFront", desc: { en: "Drive Bias Front: 0.0 is rear-wheel drive (RWD), 1.0 is front-wheel drive (FWD), 0.5 is equal 4WD.", tr: "Çekiş Oranı (Ön): 0.0 arka çeker (RWD), 1.0 ön çeker (FWD), 0.5 ise eşit dağılımlı 4 çekerdir (AWD)." } },
  initial_drive_gears: { name: "nInitialDriveGears", desc: { en: "Initial Drive Gears: The number of forward gear ratios in the vehicle's transmission.", tr: "Vites Sayısı: Aracın şanzımanındaki toplam ileri vites kademesi sayısı." } },
  drive_force: { name: "fInitialDriveForce", desc: { en: "Initial Drive Force: Engine force output multiplier, directly affecting acceleration rate.", tr: "Motor Çekiş Gücü: Motor torkunun temel çarpanı. Aracın hızlanma potansiyelini belirler." } },
  drive_inertia: { name: "fDriveInertia", desc: { en: "Drive Inertia: Governs how fast the engine revs up to redline and drops RPM.", tr: "Motor Devirlenme Hızı (İnertia): Motorun ne kadar hızlı devir alacağını ve devirden düşeceğini kontrol eder." } },
  clutch_change_rate_scale_upshift: { name: "fClutchChangeRateScaleUpShift", desc: { en: "Clutch Change Scale (Upshift): Clutch engagement rate scale on upshifts (higher = faster shifts).", tr: "Debriyaj Bırakma Hızı (Vites Büyütme): Vites büyütme sırasındaki debriyaj hızı çarpanıdır." } },
  clutch_change_rate_scale_downshift: { name: "fClutchChangeRateScaleDownShift", desc: { en: "Clutch Change Scale (Downshift): Clutch engagement rate scale on downshifts.", tr: "Debriyaj Bırakma Hızı (Vites Küçültme): Vites küçültme sırasındaki debriyaj hızı çarpanıdır." } },
  initial_drive_max_flat_vel: { name: "fInitialDriveMaxFlatVel", desc: { en: "Initial Drive Max Flat Velocity: Theoretical top speed at redline in highest gear.", tr: "Düz Yol Son Hızı: Aracın en üst viteste ulaşabileceği teorik maksimum hız sınırıdır." } },
  brake_force: { name: "fBrakeForce", desc: { en: "Brake Force: Multiplier for braking deceleration power.", tr: "Fren Gücü: Frenlerin aracı ne kadar güçlü yavaşlatacağını belirler." } },
  brake_bias_front: { name: "fBrakeBiasFront", desc: { en: "Brake Bias Front: Braking force distribution between front and rear (0.5 is equal).", tr: "Fren Dağılımı (Ön): Fren kuvvetinin ön ve arka akslar arasındaki dağılımı (0.5 = eşit)." } },
  hand_brake_force: { name: "fHandBrakeForce", desc: { en: "Hand Brake Force: Deceleration force applied by the handbrake.", tr: "El Freni Gücü: El freni çekildiğinde arka tekerleklere uygulanan kilitleme gücü." } },
  steering_lock: { name: "fSteeringLock", desc: { en: "Steering Lock: Maximum steering angle in degrees at full lock.", tr: "Direksiyon Açısı (Derece): Ön tekerleklerin dönebileceği maksimum dönüş açısı." } },
  traction_curve_max: { name: "fTractionCurveMax", desc: { en: "Traction Curve Max: Lateral cornering grip multiplier.", tr: "Maksimum Yol Tutuşu (Viraj): Viraj alırken lastiklerin sağladığı maksimum yanal yol tutuş katsayısı." } },
  traction_curve_min: { name: "fTractionCurveMin", desc: { en: "Traction Curve Min: Longitudinal traction/braking grip multiplier.", tr: "Minimum Yol Tutuşu (Çekiş): Hızlanırken veya düz frenlemede lastiklerin tutunma katsayısı." } },
  traction_curve_lateral: { name: "fTractionCurveLateral", desc: { en: "Traction Curve Lateral: Shape of the lateral traction grip curve.", tr: "Yanal Yol Tutuş Eğrisi: Kayma açısına bağlı olarak yanal tutunmanın tepki karakteri." } },
  traction_spring_delta_max: { name: "fTractionSpringDeltaMax", desc: { en: "Traction Spring Delta Max: Distance wheel can travel vertically before losing traction.", tr: "Çekiş Yay Limiti: Aracın zeminle teması kesildiğinde tekerleğin dikey kayıplarını belirler." } },
  low_speed_traction_loss_mult: { name: "fLowSpeedTractionLossMult", desc: { en: "Low Speed Traction Loss Mult: Reduces grip at low speeds to allow burnouts.", tr: "Düşük Hızda Patinaj Çarpanı: Düşük hızlarda gaza basıldığında patinaja düşme eğilimi." } },
  camber_stiffnesss: { name: "fCamberStiffnesss", desc: { en: "Camber Stiffness: Modifies tire grip during drift angle states.", tr: "Kamber Sertliği: Virajlarda lastik kamber açısının yanal tutuşa ve kaymaya etkisi." } },
  traction_bias_front: { name: "fTractionBiasFront", desc: { en: "Traction Bias Front: Front vs rear tire traction distribution.", tr: "Yol Tutuş Dağılımı (Ön): Lastik tutunma odağının ön ve arka tekerlekler arasındaki dağılımı." } },
  traction_loss_mult: { name: "fTractionLossMult", desc: { en: "Traction Loss Mult: Determines grip loss on off-road surfaces.", tr: "Yüzey Kayıp Çarpanı: Asfalt dışı zeminlerde (çamur, toprak) yol tutuşunun azalma çarpanı." } },
  suspension_force: { name: "fSuspensionForce", desc: { en: "Suspension Force: Stiffness multiplier for the suspension springs.", tr: "Süspansiyon Sertliği: Amortisör yaylarının sertlik katsayısı. Yüksek değerler aracı sertleştirir." } },
  suspension_comp_damp: { name: "fSuspensionCompDamp", desc: { en: "Suspension Compression Damping: Resists upward shock movement.", tr: "Sıkışma Sönümlemesi: Süspansiyon yukarı doğru sıkışırken amortisörün tepki direnci." } },
  suspension_rebound_damp: { name: "fSuspensionReboundDamp", desc: { en: "Suspension Rebound Damping: Controls return speed after compression.", tr: "Geri Sekme Sönümlemesi: Sıkışan süspansiyon geri açılırken amortisörün sekme direnci." } },
  suspension_upper_limit: { name: "fSuspensionUpperLimit", desc: { en: "Suspension Upper Limit: Visual limit on how far wheels can travel upward.", tr: "Süspansiyon Üst Limiti: Tekerleğin çamurluk içine dikeyde ne kadar yaklaşabileceğinin sınırı." } },
  suspension_lower_limit: { name: "fSuspensionLowerLimit", desc: { en: "Suspension Lower Limit: Visual limit on how far wheels can drop downward.", tr: "Süspansiyon Alt Limiti: Tekerleğin aşağı doğru dikey yönde ne kadar sarkabileceğinin sınırı." } },
  suspension_raise: { name: "fSuspensionRaise", desc: { en: "Suspension Raise: Adjusts ground clearance height of the chassis.", tr: "Süspansiyon Yüksekliği: Gövdenin tekerleklerden ne kadar yüksekte konumlanacağını ayarlar." } },
  suspension_bias_front: { name: "fSuspensionBiasFront", desc: { en: "Suspension Bias Front: Stiffens front suspension relative to rear.", tr: "Süspansiyon Dağılımı (Ön): Ön süspansiyonun arkaya göre sertlik odağı (0.5 = eşit)." } },
  anti_roll_bar_force: { name: "fAntiRollBarForce", desc: { en: "Anti Roll Bar Force: Reduces body roll in corners.", tr: "Viraj Demiri Gücü: Virajlarda gövdenin yana yatmasını (roll) engelleyen stabilizatör bar gücü." } },
  anti_roll_bar_bias_front: { name: "fAntiRollBarBiasFront", desc: { en: "Anti Roll Bar Bias Front: Distribution of anti-roll bar force (0 is front, 1 is rear).", tr: "Viraj Demiri Dağılımı (Ön): Viraj denge çubuğu kuvvetinin ön akstaki ağırlığı." } },
  roll_centre_height_front: { name: "fRollCentreHeightFront", desc: { en: "Roll Centre Height Front: Longitudinal roll axis height at the front (higher = less rollover).", tr: "Ön Yuvarlanma Merkezi Yüksekliği: Ön tekerleklerin ağırlık transferi sırasındaki yatma ekseni yüksekliği." } },
  roll_centre_height_rear: { name: "fRollCentreHeightRear", desc: { en: "Roll Centre Height Rear: Longitudinal roll axis height at the rear (affects wheelies).", tr: "Arka Yuvarlanma Merkezi Yüksekliği: Hızlanma sırasında arkaya ağırlık transferini etkiler. Yüksek değerler tek teker kaldırmayı (wheelie) kolaylaştırır." } },
  collision_damage_mult: { name: "fCollisionDamageMult", desc: { en: "Collision Damage Mult: Damage received in vehicle-to-vehicle crashes.", tr: "Çarpışma Hasar Çarpanı: Çarpışmalardan alınan hasar miktarını çarpar." } },
  weapon_damage_mult: { name: "fWeaponDamageMult", desc: { en: "Weapon Damage Mult: Damage multiplier for bullet and weapon impacts.", tr: "Silah Hasar Çarpanı: Mermi ve patlayıcılardan alınan hasar miktarını çarpar." } },
  damage_mult: { name: "fDeformationDamageMult", desc: { en: "Deformation Damage Mult: Scale of physical body deformation during crashes.", tr: "Deformasyon Hasar Çarpanı: Kaportanın çarpışmalarda ne derece ezileceğini ve bozulacağını belirler." } },
  engine_damage_mult: { name: "fEngineDamageMult", desc: { en: "Engine Damage Mult: Engine failure and explosive damage multiplier.", tr: "Motor Hasar Çarpanı: Motorun hasar alıp alev alma veya bozulma eğilimini çarpar." } },
  petrol_tank_volume: { name: "fPetrolTankVolume", desc: { en: "Petrol Tank Volume: Volume of petrol leaked after fuel tank puncture.", tr: "Yakıt Tankı Hacmi: Depo delindikten sonra ne kadar yakıt sızdırılacağını belirler." } },
  oil_volume: { name: "fOilVolume", desc: { en: "Oil Volume: Engine oil volume metric.", tr: "Yağ Hacmi: Aracın motor yağ miktarını temsil eder." } },
  monetary_value: { name: "nMonetaryValue", desc: { en: "Monetary Value: Financial value score of the vehicle in-game.", tr: "Parasal Değer: Aracın oyun içi finansal/parasal karşılığı." } },
  centre_of_mass_offset: { name: "vecCentreOfMassOffset", desc: { en: "Center of Mass Offset: Shifts the center of gravity along X (lateral), Y (longitudinal), and Z (vertical) axes.", tr: "Ağırlık Merkezi Sapması: X (yanal), Y (ön-arka) ve Z (dikey) eksenlerinde ağırlık merkezini kaydırır." } },
  inertia_multiplier: { name: "vecInertiaMultiplier", desc: { en: "Inertia Multiplier: Modifies rotational inertia on X, Y, and Z axes, affecting responsiveness.", tr: "Atalet Çarpanı: Aracın X, Y ve Z eksenlerinde dönme ve hareket ataletini belirler. Tepkiselliği etkiler." } },
  seat_offset_dist_x: { name: "fSeatOffsetDistX", desc: { en: "Seat Offset Distance X: Driver vs passenger horizontal lateral offset.", tr: "Koltuk Ofset X: Sürücü koltuğunun sağa/sola kaydırılma mesafesi." } },
  seat_offset_dist_y: { name: "fSeatOffsetDistY", desc: { en: "Seat Offset Distance Y: Forward/backward longitudinal offset.", tr: "Koltuk Ofset Y: Koltuğun ön panele veya arkaya kaydırılma mesafesi." } },
  seat_offset_dist_z: { name: "fSeatOffsetDistZ", desc: { en: "Seat Offset Distance Z: Vertical seat height adjustment offset.", tr: "Koltuk Ofset Z: Koltuğun yukarı/aşağı yükseklik ayarı sapması." } }
};

export const VehicleEditor: React.FC = () => {
  const { settings } = useStore();
  const t = translations[settings.language] || translations.en;

  const [folderPath, setFolderPath] = useState('');
  const [vehicles, setVehicles] = useState<VehicleConfig[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    engine: true,
    brakes: false,
    traction: false,
    suspension: false,
    damage: false,
    chassis: false
  });

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const commonSounds = ['FUTO', 'SULTAN', 'ADDER', 'T20', 'COMET2', 'SURGE', 'FUSILADE', 'SCHWARZER', 'SENTINEL', 'TOWTRUCK'];

  const handleSelectFolder = async () => {
    try {
      setErrorMsg('');
      setSuccessMsg('');
      const selected = await open({
        directory: true,
        multiple: false,
        title: t.selectVehicleToEdit
      });

      if (selected && typeof selected === 'string') {
        setFolderPath(selected);
        loadConfigs(selected);
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Error choosing path');
    }
  };

  const loadConfigs = async (path: string) => {
    try {
      setErrorMsg('');
      const data = await invoke<VehicleConfig[]>('load_vehicle_editor_configs', { dirPath: path });
      setVehicles(data);
      if (data.length > 0) {
        setSelectedIdx(0);
      } else {
        setSelectedIdx(null);
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Failed to load vehicle configs.');
      setVehicles([]);
      setSelectedIdx(null);
    }
  };

  const handleSave = async () => {
    if (!folderPath || vehicles.length === 0) return;
    setIsSaving(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await invoke('save_vehicle_editor_configs', {
        dirPath: folderPath,
        configs: vehicles
      });
      setSuccessMsg(t.settingsSuccess);
    } catch (e: any) {
      setErrorMsg(e.message || 'Failed to save configurations.');
    } finally {
      setIsSaving(false);
    }
  };

  const updateSelectedVehicle = (updater: (veh: VehicleConfig) => VehicleConfig) => {
    if (selectedIdx === null) return;
    const updated = [...vehicles];
    updated[selectedIdx] = updater(updated[selectedIdx]);
    setVehicles(updated);
  };

  const activeVeh = selectedIdx !== null ? vehicles[selectedIdx] : null;

  const InfoIcon: React.FC<{ fieldKey: string }> = ({ fieldKey }) => {
    const info = fieldInfos[fieldKey];
    if (!info) return null;
    const descText = settings.language === 'tr' ? info.desc.tr : info.desc.en;
    return (
      <div className="relative group ml-1.5 inline-block shrink-0">
        <Info size={13} className="text-slate-500 hover:text-slate-300 cursor-help" />
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-[10px] text-slate-300 opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 shadow-xl leading-normal font-medium">
          <p className="font-bold text-white mb-0.5">{info.name}</p>
          <p className="opacity-90">{descText}</p>
        </div>
      </div>
    );
  };

  const renderFloatInput = (label: string, fieldKey: keyof VehicleHandlingPhysics, step: string = "any") => {
    if (!activeVeh || !activeVeh.physics) return null;
    const value = activeVeh.physics[fieldKey] as number;
    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center text-[10px] font-bold text-slate-500 uppercase tracking-wider">
          <span>{label}</span>
          <InfoIcon fieldKey={fieldKey.toString()} />
        </div>
        <input
          type="number"
          step={step}
          value={value}
          onChange={(e) => {
            const val = parseFloat(e.target.value);
            updateSelectedVehicle(v => ({
              ...v,
              physics: v.physics ? { ...v.physics, [fieldKey]: isNaN(val) ? 0 : val } : null
            }));
          }}
          className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-violet-500 w-full font-semibold"
        />
      </div>
    );
  };

  const renderIntInput = (label: string, fieldKey: keyof VehicleHandlingPhysics) => {
    if (!activeVeh || !activeVeh.physics) return null;
    const value = activeVeh.physics[fieldKey] as number;
    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center text-[10px] font-bold text-slate-500 uppercase tracking-wider">
          <span>{label}</span>
          <InfoIcon fieldKey={fieldKey.toString()} />
        </div>
        <input
          type="number"
          step="1"
          value={value}
          onChange={(e) => {
            const val = parseInt(e.target.value, 10);
            updateSelectedVehicle(v => ({
              ...v,
              physics: v.physics ? { ...v.physics, [fieldKey]: isNaN(val) ? 0 : val } : null
            }));
          }}
          className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-violet-500 w-full font-semibold"
        />
      </div>
    );
  };

  const renderVectorInput = (label: string, fieldKey: 'centre_of_mass_offset' | 'inertia_multiplier') => {
    if (!activeVeh || !activeVeh.physics) return null;
    const value = activeVeh.physics[fieldKey] as [number, number, number];
    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center text-[10px] font-bold text-slate-500 uppercase tracking-wider">
          <span>{label}</span>
          <InfoIcon fieldKey={fieldKey} />
        </div>
        <div className="grid grid-cols-3 gap-2">
          {['X', 'Y', 'Z'].map((axis, idx) => (
            <div key={axis} className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl px-2 py-1.5">
              <span className="text-[10px] text-slate-500 font-bold">{axis}</span>
              <input
                type="number"
                step="any"
                value={value[idx]}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  const newVal = [...value] as [number, number, number];
                  newVal[idx] = isNaN(val) ? 0.0 : val;
                  updateSelectedVehicle(v => ({
                    ...v,
                    physics: v.physics ? { ...v.physics, [fieldKey]: newVal } : null
                  }));
                }}
                className="w-full bg-transparent text-xs text-slate-300 focus:outline-none font-mono font-semibold"
              />
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderSectionHeader = (title: string, sectionKey: string) => {
    const isExpanded = expandedSections[sectionKey];
    return (
      <div 
        onClick={() => toggleSection(sectionKey)}
        className="flex items-center justify-between p-3 bg-slate-900/60 border border-white/5 rounded-xl cursor-pointer hover:bg-slate-900 transition-colors"
      >
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{title}</span>
        {isExpanded ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col gap-6 p-6 overflow-y-auto bg-[#05070e] text-slate-100 h-full">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-extrabold text-white tracking-tight">{t.vehicleEditor}</h2>
        <p className="text-sm text-slate-400">{t.editorDesc}</p>
      </div>

      {/* Path Input */}
      <div className="glass-panel p-4 rounded-2xl border border-white/5 flex gap-3 items-center">
        <div className="flex-1 relative">
          <input 
            type="text" 
            placeholder={t.selectVehicleToEdit}
            value={folderPath}
            onChange={(e) => setFolderPath(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800/80 rounded-xl px-4 py-2.5 text-xs text-slate-300 focus:outline-none"
          />
        </div>
        <button 
          onClick={handleSelectFolder}
          className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white cursor-pointer"
        >
          <FolderOpen size={16} />
        </button>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs font-semibold flex items-center gap-2">
          <AlertTriangle size={16} />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 size={16} />
          <span>{successMsg}</span>
        </div>
      )}

      {vehicles.length > 0 && (
        <div className="grid grid-cols-3 gap-6 items-start">
          {/* Vehicles List */}
          <div className="glass-panel p-5 rounded-2xl border border-white/5 flex flex-col gap-4 sticky top-0">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Car size={16} className="text-indigo-400" />
              <span>{settings.language === 'tr' ? 'Mevcut Araçlar' : 'Detected Vehicles'}</span>
            </h3>
            
            <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto">
              {vehicles.map((veh, idx) => (
                <div 
                  key={idx}
                  onClick={() => setSelectedIdx(idx)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center gap-3 ${
                    selectedIdx === idx 
                      ? 'bg-indigo-600/10 border-indigo-500 text-indigo-400' 
                      : 'bg-slate-900/40 border-white/5 text-slate-300 hover:bg-slate-900/60'
                  }`}
                >
                  <Car size={16} />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white truncate">{veh.model_name}</p>
                    <p className="text-[10px] text-slate-500 truncate mt-0.5">{veh.handling_id}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Active Config Form */}
          {activeVeh && (
            <div className="col-span-2 flex flex-col gap-5">
              {/* Handling Physics Expandable Accordions */}
              {activeVeh.physics && (
                <div className="flex flex-col gap-3">
                  
                  {/* 1. Engine & Transmission */}
                  <div className="flex flex-col gap-2.5">
                    {renderSectionHeader(settings.language === 'tr' ? 'Motor & Şanzıman' : 'Engine & Transmission', 'engine')}
                    {expandedSections.engine && (
                      <div className="glass-panel p-5 rounded-2xl border border-white/5 grid grid-cols-2 gap-4">
                        {renderIntInput(settings.language === 'tr' ? 'Vites Sayısı' : 'Drive Gears', 'initial_drive_gears')}
                        {renderFloatInput(settings.language === 'tr' ? 'Çekiş Gücü' : 'Drive Force', 'drive_force')}
                        {renderFloatInput(settings.language === 'tr' ? 'Motor Atalet Değeri' : 'Drive Inertia', 'drive_inertia')}
                        {renderFloatInput(settings.language === 'tr' ? 'Düz Yol Son Hızı' : 'Max Flat Velocity', 'initial_drive_max_flat_vel')}
                        {renderFloatInput(settings.language === 'tr' ? 'Debriyaj Hızı (Vites Büyütme)' : 'Clutch Scale Up', 'clutch_change_rate_scale_upshift')}
                        {renderFloatInput(settings.language === 'tr' ? 'Debriyaj Hızı (Vites Küçültme)' : 'Clutch Scale Down', 'clutch_change_rate_scale_downshift')}
                        {renderFloatInput(settings.language === 'tr' ? 'Çekiş Oranı (Ön)' : 'Drive Bias Front', 'drive_bias_front')}
                      </div>
                    )}
                  </div>

                  {/* 2. Brakes & Steering */}
                  <div className="flex flex-col gap-2.5">
                    {renderSectionHeader(settings.language === 'tr' ? 'Fren & Direksiyon' : 'Brakes & Steering', 'brakes')}
                    {expandedSections.brakes && (
                      <div className="glass-panel p-5 rounded-2xl border border-white/5 grid grid-cols-2 gap-4">
                        {renderFloatInput(settings.language === 'tr' ? 'Fren Gücü' : 'Brake Force', 'brake_force')}
                        {renderFloatInput(settings.language === 'tr' ? 'Fren Dağılımı (Ön)' : 'Brake Bias Front', 'brake_bias_front')}
                        {renderFloatInput(settings.language === 'tr' ? 'El Freni Gücü' : 'Hand Brake Force', 'hand_brake_force')}
                        {renderFloatInput(settings.language === 'tr' ? 'Direksiyon Kilidi (Açı)' : 'Steering Lock', 'steering_lock')}
                      </div>
                    )}
                  </div>

                  {/* 3. Traction & Grip */}
                  <div className="flex flex-col gap-2.5">
                    {renderSectionHeader(settings.language === 'tr' ? 'Yol Tutuş & Kayma' : 'Traction & Grip', 'traction')}
                    {expandedSections.traction && (
                      <div className="glass-panel p-5 rounded-2xl border border-white/5 grid grid-cols-2 gap-4">
                        {renderFloatInput(settings.language === 'tr' ? 'Viraj Yol Tutuşu' : 'Traction Curve Max', 'traction_curve_max')}
                        {renderFloatInput(settings.language === 'tr' ? 'Düz Hat Yol Tutuşu' : 'Traction Curve Min', 'traction_curve_min')}
                        {renderFloatInput(settings.language === 'tr' ? 'Yanal Yol Tutuş Dağılımı' : 'Traction Curve Lateral', 'traction_curve_lateral')}
                        {renderFloatInput(settings.language === 'tr' ? 'Dikey Yay Limit Sapması' : 'Traction Spring Delta Max', 'traction_spring_delta_max')}
                        {renderFloatInput(settings.language === 'tr' ? 'Düşük Hız Tutunma Kaybı' : 'Low Speed Traction Loss Mult', 'low_speed_traction_loss_mult')}
                        {renderFloatInput(settings.language === 'tr' ? 'Kamber Açısı Sertliği' : 'Camber Stiffness', 'camber_stiffnesss')}
                        {renderFloatInput(settings.language === 'tr' ? 'Çekiş Dengesi (Ön)' : 'Traction Bias Front', 'traction_bias_front')}
                        {renderFloatInput(settings.language === 'tr' ? 'Yol Kayıp Direnci' : 'Traction Loss Mult', 'traction_loss_mult')}
                      </div>
                    )}
                  </div>

                  {/* 4. Suspension & Body Balance */}
                  <div className="flex flex-col gap-2.5">
                    {renderSectionHeader(settings.language === 'tr' ? 'Süspansiyon & Denge' : 'Suspension & Body Balance', 'suspension')}
                    {expandedSections.suspension && (
                      <div className="glass-panel p-5 rounded-2xl border border-white/5 grid grid-cols-2 gap-4">
                        {renderFloatInput(settings.language === 'tr' ? 'Süspansiyon Sertliği' : 'Suspension Force', 'suspension_force')}
                        {renderFloatInput(settings.language === 'tr' ? 'Sıkışma Sönümlemesi' : 'Suspension Comp Damp', 'suspension_comp_damp')}
                        {renderFloatInput(settings.language === 'tr' ? 'Geri Sekme Direnci' : 'Suspension Rebound Damp', 'suspension_rebound_damp')}
                        {renderFloatInput(settings.language === 'tr' ? 'Süspansiyon Üst Limiti' : 'Suspension Upper Limit', 'suspension_upper_limit')}
                        {renderFloatInput(settings.language === 'tr' ? 'Süspansiyon Alt Limiti' : 'Suspension Lower Limit', 'suspension_lower_limit')}
                        {renderFloatInput(settings.language === 'tr' ? 'Süspansiyon Yüksekliği' : 'Suspension Raise', 'suspension_raise')}
                        {renderFloatInput(settings.language === 'tr' ? 'Süspansiyon Dengesi (Ön)' : 'Suspension Bias Front', 'suspension_bias_front')}
                        {renderFloatInput(settings.language === 'tr' ? 'Viraj Demiri Direnci' : 'Anti Roll Bar Force', 'anti_roll_bar_force')}
                        {renderFloatInput(settings.language === 'tr' ? 'Viraj Demiri Dengesi (Ön)' : 'Anti Roll Bar Bias Front', 'anti_roll_bar_bias_front')}
                        {renderFloatInput(settings.language === 'tr' ? 'Ön Yuvarlanma Ekseni' : 'Roll Centre Height Front', 'roll_centre_height_front')}
                        {renderFloatInput(settings.language === 'tr' ? 'Arka Yuvarlanma Ekseni' : 'Roll Centre Height Rear', 'roll_centre_height_rear')}
                      </div>
                    )}
                  </div>

                  {/* 5. Damage & Capacities */}
                  <div className="flex flex-col gap-2.5">
                    {renderSectionHeader(settings.language === 'tr' ? 'Hasar Alımı & Hacimler' : 'Damage & Capacities', 'damage')}
                    {expandedSections.damage && (
                      <div className="glass-panel p-5 rounded-2xl border border-white/5 grid grid-cols-2 gap-4">
                        {renderFloatInput(settings.language === 'tr' ? 'Çarpışma Hasar Çarpanı' : 'Collision Damage Mult', 'collision_damage_mult')}
                        {renderFloatInput(settings.language === 'tr' ? 'Silah Hasar Çarpanı' : 'Weapon Damage Mult', 'weapon_damage_mult')}
                        {renderFloatInput(settings.language === 'tr' ? 'Deformasyon Hasar Çarpanı' : 'Deformation Damage Mult', 'damage_mult')}
                        {renderFloatInput(settings.language === 'tr' ? 'Motor Hasar Çarpanı' : 'Engine Damage Mult', 'engine_damage_mult')}
                        {renderFloatInput(settings.language === 'tr' ? 'Yakıt Tankı Hacmi' : 'Petrol Tank Volume', 'petrol_tank_volume')}
                        {renderFloatInput(settings.language === 'tr' ? 'Motor Yağı Hacmi' : 'Oil Volume', 'oil_volume')}
                      </div>
                    )}
                  </div>

                  {/* 6. Chassis & Dimensions */}
                  <div className="flex flex-col gap-2.5">
                    {renderSectionHeader(settings.language === 'tr' ? 'Şasi & Ağırlık Özellikleri' : 'Chassis & Dimensions', 'chassis')}
                    {expandedSections.chassis && (
                      <div className="glass-panel p-5 rounded-2xl border border-white/5 flex flex-col gap-4">
                        <div className="grid grid-cols-2 gap-4">
                          {renderFloatInput(settings.language === 'tr' ? 'Araç Kütlesi (kg)' : 'Mass (kg)', 'mass')}
                          {renderFloatInput(settings.language === 'tr' ? 'Hava Direnç Çarpanı' : 'Drag Coefficient', 'drag')}
                          {renderFloatInput(settings.language === 'tr' ? 'Aşağı Basma Gücü Çarpanı' : 'Downforce Modifier', 'downforce_modifier')}
                          {renderFloatInput(settings.language === 'tr' ? 'Su Altında Kalma Oranı' : 'Submerged Percentage', 'percent_submerged')}
                          {renderIntInput(settings.language === 'tr' ? 'Parasal Değeri' : 'Monetary Value', 'monetary_value')}
                        </div>
                        {renderVectorInput(settings.language === 'tr' ? 'Ağırlık Merkezi Sapması' : 'Center of Mass Offset', 'centre_of_mass_offset')}
                        {renderVectorInput(settings.language === 'tr' ? 'Atalet Çarpanı' : 'Inertia Multiplier', 'inertia_multiplier')}
                        <div className="grid grid-cols-3 gap-2">
                          {renderFloatInput(settings.language === 'tr' ? 'Koltuk Ofseti X' : 'Seat Offset X', 'seat_offset_dist_x')}
                          {renderFloatInput(settings.language === 'tr' ? 'Koltuk Ofseti Y' : 'Seat Offset Y', 'seat_offset_dist_y')}
                          {renderFloatInput(settings.language === 'tr' ? 'Koltuk Ofseti Z' : 'Seat Offset Z', 'seat_offset_dist_z')}
                        </div>
                      </div>
                    )}
                  </div>

                </div>
              )}

              {/* Sound & Identifiers Card */}
              <div className="glass-panel p-5 rounded-2xl border border-white/5 flex flex-col gap-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  <Volume2 size={16} className="text-cyan-400" />
                  <span>{t.engineAudioConfig}</span>
                </h3>

                <div className="grid grid-cols-2 gap-4">
                  {/* Audio Name Hash */}
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      {t.audioHashLabel}
                    </label>
                    <div className="flex flex-col gap-2">
                      <input 
                        type="text" 
                        value={activeVeh.audio_name_hash.toString()} 
                        onChange={(e) => {
                          const val = e.target.value;
                          updateSelectedVehicle((v) => ({ ...v, audio_name_hash: val }));
                        }}
                        className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none"
                      />
                      <div className="flex flex-wrap gap-1">
                        {commonSounds.map((sound) => (
                          <button
                            key={sound}
                            onClick={() => {
                              updateSelectedVehicle((v) => ({ ...v, audio_name_hash: sound }));
                            }}
                            className={`px-2 py-1 rounded-lg text-[9px] font-bold border transition-colors cursor-pointer ${
                              activeVeh.audio_name_hash.toUpperCase() === sound.toUpperCase()
                                ? 'bg-cyan-500/10 border-cyan-500 text-cyan-400'
                                : 'bg-slate-900/60 border-slate-800 text-slate-500 hover:text-white'
                            }`}
                          >
                            {sound}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Layout Hash */}
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      {t.layoutLabel}
                    </label>
                    <input 
                      type="text" 
                      value={activeVeh.layout.toString()} 
                      onChange={(e) => {
                        const val = e.target.value;
                        updateSelectedVehicle((v) => ({ ...v, layout: val }));
                      }}
                      className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Action Save Button */}
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 active:scale-[0.99] text-white text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-violet-600/20 disabled:opacity-50"
              >
                <CheckCircle2 size={16} />
                <span>{isSaving ? t.savingState || 'Saving...' : t.saveConfigBtn}</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

