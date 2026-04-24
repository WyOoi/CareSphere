export interface MalaysiaHospitalSeed {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  phone: string;
  type: string;
  emergencyAvailable: boolean;
  lat: number;
  lng: number;
}

export const MALAYSIA_HOSPITALS: MalaysiaHospitalSeed[] = [
  { id: 'hkl', name: 'Hospital Kuala Lumpur (HKL)', address: 'Jalan Pahang, 50586 Kuala Lumpur', city: 'Kuala Lumpur', state: 'Wilayah Persekutuan', phone: '03-2615 5555', type: 'Government Hospital', emergencyAvailable: true, lat: 3.1718, lng: 101.7022 },
  { id: 'hukm', name: 'Hospital Canselor Tuanku Muhriz (HUKM)', address: 'Jalan Yaacob Latiff, Bandar Tun Razak, 56000 Kuala Lumpur', city: 'Kuala Lumpur', state: 'Wilayah Persekutuan', phone: '03-9145 5555', type: 'University Hospital', emergencyAvailable: true, lat: 3.0954, lng: 101.7259 },
  { id: 'ppum', name: 'Pusat Perubatan Universiti Malaya (PPUM)', address: 'Lembah Pantai, 59100 Kuala Lumpur', city: 'Kuala Lumpur', state: 'Wilayah Persekutuan', phone: '03-7949 4422', type: 'University Hospital', emergencyAvailable: true, lat: 3.1122, lng: 101.6528 },
  { id: 'hsa-selangor', name: 'Hospital Shah Alam', address: 'Persiaran Kayangan, Seksyen 7, 40000 Shah Alam', city: 'Shah Alam', state: 'Selangor', phone: '03-5526 3000', type: 'Government Hospital', emergencyAvailable: true, lat: 3.0737, lng: 101.5182 },
  { id: 'hsb', name: 'Hospital Sungai Buloh', address: 'Jalan Hospital, 47000 Sungai Buloh', city: 'Sungai Buloh', state: 'Selangor', phone: '03-6145 4333', type: 'Government Hospital', emergencyAvailable: true, lat: 3.2280, lng: 101.5823 },
  { id: 'sunway-medical', name: 'Sunway Medical Centre', address: 'No 5, Jalan Lagoon Selatan, 47500 Subang Jaya', city: 'Subang Jaya', state: 'Selangor', phone: '03-7491 9191', type: 'Private Hospital', emergencyAvailable: true, lat: 3.0724, lng: 101.6072 },
  { id: 'hsa-jb', name: 'Hospital Sultanah Aminah Johor Bahru', address: 'Jalan Persiaran Abu Bakar Sultan, 80100 Johor Bahru', city: 'Johor Bahru', state: 'Johor', phone: '07-225 7000', type: 'Government Hospital', emergencyAvailable: true, lat: 1.4655, lng: 103.7455 },
  { id: 'kpj-jb', name: 'KPJ Johor Specialist Hospital', address: '39-B, Jalan Abdul Samad, 80100 Johor Bahru', city: 'Johor Bahru', state: 'Johor', phone: '07-225 3000', type: 'Specialist Hospital', emergencyAvailable: true, lat: 1.4704, lng: 103.7542 },
  { id: 'hpb', name: 'Hospital Pakar Sultanah Fatimah', address: 'Jalan Salleh, 84000 Muar', city: 'Muar', state: 'Johor', phone: '06-952 1901', type: 'Government Hospital', emergencyAvailable: true, lat: 2.0500, lng: 102.5681 },
  { id: 'hpp', name: 'Hospital Pulau Pinang', address: 'Jalan Residensi, 10990 George Town', city: 'George Town', state: 'Pulau Pinang', phone: '04-222 5333', type: 'Government Hospital', emergencyAvailable: true, lat: 5.4174, lng: 100.3119 },
  { id: 'adventist-penang', name: 'Penang Adventist Hospital', address: '465 Jalan Burma, 10350 George Town', city: 'George Town', state: 'Pulau Pinang', phone: '04-222 7200', type: 'Private Hospital', emergencyAvailable: true, lat: 5.4327, lng: 100.3093 },
  { id: 'hrpb', name: 'Hospital Raja Permaisuri Bainun', address: 'Jalan Raja Ashman Shah, 30450 Ipoh', city: 'Ipoh', state: 'Perak', phone: '05-208 5000', type: 'Government Hospital', emergencyAvailable: true, lat: 4.5896, lng: 101.0901 },
  { id: 'hklr', name: 'Hospital Kuala Kangsar', address: 'Jalan Taiping, 33000 Kuala Kangsar', city: 'Kuala Kangsar', state: 'Perak', phone: '05-776 3333', type: 'Government Hospital', emergencyAvailable: true, lat: 4.7732, lng: 100.9405 },
  { id: 'htjs', name: 'Hospital Tuanku Jaafar Seremban', address: 'Jalan Rasah, 70300 Seremban', city: 'Seremban', state: 'Negeri Sembilan', phone: '06-768 4000', type: 'Government Hospital', emergencyAvailable: true, lat: 2.7244, lng: 101.9381 },
  { id: 'columbia-asia-seremban', name: 'Columbia Asia Hospital Seremban', address: 'Oakland Commercial Centre, 70300 Seremban', city: 'Seremban', state: 'Negeri Sembilan', phone: '06-603 3333', type: 'Private Hospital', emergencyAvailable: true, lat: 2.7053, lng: 101.9417 },
  { id: 'hospital-melaka', name: 'Hospital Melaka', address: 'Jalan Mufti Haji Khalil, 75400 Melaka', city: 'Melaka', state: 'Melaka', phone: '06-289 2344', type: 'Government Hospital', emergencyAvailable: true, lat: 2.2247, lng: 102.2544 },
  { id: 'putra-melaka', name: 'Putra Specialist Hospital', address: '33 Jalan Tun Sri Lanang, 75100 Melaka', city: 'Melaka', state: 'Melaka', phone: '06-289 1999', type: 'Private Hospital', emergencyAvailable: true, lat: 2.1917, lng: 102.2488 },
  { id: 'tengku-ampuan-afzan', name: 'Hospital Tengku Ampuan Afzan', address: 'Jalan Tanah Putih, 25100 Kuantan', city: 'Kuantan', state: 'Pahang', phone: '09-557 2222', type: 'Government Hospital', emergencyAvailable: true, lat: 3.8199, lng: 103.3213 },
  { id: 'kuantan-specialist', name: 'Kuantan Medical Centre', address: 'Jalan Tun Ismail, 25000 Kuantan', city: 'Kuantan', state: 'Pahang', phone: '09-565 0000', type: 'Private Hospital', emergencyAvailable: true, lat: 3.8156, lng: 103.3317 },
  { id: 'hrpz2', name: 'Hospital Raja Perempuan Zainab II', address: 'Jalan Hospital, 15586 Kota Bharu', city: 'Kota Bharu', state: 'Kelantan', phone: '09-745 2000', type: 'Government Hospital', emergencyAvailable: true, lat: 6.1232, lng: 102.2461 },
  { id: 'husm', name: 'Hospital Universiti Sains Malaysia (HUSM)', address: 'Kubang Kerian, 16150 Kota Bharu', city: 'Kota Bharu', state: 'Kelantan', phone: '09-767 3000', type: 'University Hospital', emergencyAvailable: true, lat: 6.0906, lng: 102.2739 },
  { id: 'sultanah-nur-zahirah', name: 'Hospital Sultanah Nur Zahirah', address: 'Jalan Sultan Mahmud, 20400 Kuala Terengganu', city: 'Kuala Terengganu', state: 'Terengganu', phone: '09-621 2121', type: 'Government Hospital', emergencyAvailable: true, lat: 5.3300, lng: 103.1376 },
  { id: 'hospital-alor-setar', name: 'Hospital Sultanah Bahiyah', address: 'Lebuhraya Darul Aman, 05460 Alor Setar', city: 'Alor Setar', state: 'Kedah', phone: '04-740 6233', type: 'Government Hospital', emergencyAvailable: true, lat: 6.1248, lng: 100.3704 },
  { id: 'hospital-kangar', name: 'Hospital Tuanku Fauziah', address: 'Jalan Tun Abdul Razak, 01000 Kangar', city: 'Kangar', state: 'Perlis', phone: '04-973 8000', type: 'Government Hospital', emergencyAvailable: true, lat: 6.4376, lng: 100.1986 },
  { id: 'queen-elizabeth', name: 'Hospital Queen Elizabeth', address: 'Lorong Bersatu, 88300 Kota Kinabalu', city: 'Kota Kinabalu', state: 'Sabah', phone: '088-517 555', type: 'Government Hospital', emergencyAvailable: true, lat: 5.9563, lng: 116.0722 },
  { id: 'gleneagles-kk', name: 'Gleneagles Hospital Kota Kinabalu', address: 'Riverson @ Sembulan, 88100 Kota Kinabalu', city: 'Kota Kinabalu', state: 'Sabah', phone: '088-518 888', type: 'Private Hospital', emergencyAvailable: true, lat: 5.9672, lng: 116.0597 },
  { id: 'sarawak-general', name: 'Sarawak General Hospital', address: 'Jalan Hospital, 93586 Kuching', city: 'Kuching', state: 'Sarawak', phone: '082-276 666', type: 'Government Hospital', emergencyAvailable: true, lat: 1.5545, lng: 110.3432 },
  { id: 'normah', name: 'Normah Medical Specialist Centre', address: 'Jalan Tun Abdul Rahman Yaakub, 93050 Kuching', city: 'Kuching', state: 'Sarawak', phone: '082-440 055', type: 'Private Hospital', emergencyAvailable: true, lat: 1.5583, lng: 110.3688 },
  { id: 'putrajaya-hospital', name: 'Hospital Putrajaya', address: 'Presint 7, 62250 Putrajaya', city: 'Putrajaya', state: 'Putrajaya', phone: '03-8312 4200', type: 'Government Hospital', emergencyAvailable: true, lat: 2.9269, lng: 101.6934 },
  { id: 'cyberjaya-hospital', name: 'Cyberjaya Hospital', address: 'Cyber 11, 63000 Cyberjaya', city: 'Cyberjaya', state: 'Selangor', phone: '03-8687 3000', type: 'Private Hospital', emergencyAvailable: true, lat: 2.9224, lng: 101.6548 },
];
