'use client';

import {useState, useEffect} from 'react';
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Spinner,
  Pagination,
  Input,
  Card,
  CardBody,
} from '@nextui-org/react';
import {format} from 'date-fns';
import supabase, {safeSupabaseOperation} from '@/lib/supabase';
import {WaterLevelMeasurement} from '@/types';
import DashboardLayout from '@/components/DashboardLayout';
import LineChartComponent from '@/components/LineChart';

export default function WaterLevelsPage() {
  const [measurements, setMeasurements] = useState<WaterLevelMeasurement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [chartData, setChartData] = useState({
    labels: [] as string[],
    datasets: [
      {
        label: 'Water Level (cm)',
        data: [] as number[],
        borderColor: 'rgb(53, 162, 235)',
        backgroundColor: 'rgba(53, 162, 235, 0.5)',
      },
    ],
  });

  const fetchMeasurements = async () => {
    setIsLoading(true);
    try {
      const {data, error} = await safeSupabaseOperation(() =>
        supabase
          .from('water_level_measurements')
          .select('*')
          .order('timestamp', {ascending: false})
          .limit(100),
      );

      if (error) {
        console.error('Error fetching water level measurements:', error);
        return;
      }

      setMeasurements(data as WaterLevelMeasurement[]);

      // Prepare chart data
      if (data && data.length > 0) {
        const filteredData = data
          .filter((m: WaterLevelMeasurement) => m.water_level_cm !== null)
          .sort(
            (a: WaterLevelMeasurement, b: WaterLevelMeasurement) =>
              new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
          );

        const locations = [
          ...new Set(
            filteredData.map((m: WaterLevelMeasurement) => m.location_name),
          ),
        ]
          .filter(Boolean)
          .map(loc => String(loc)) as string[];

        // Group data by location
        const datasets = locations.map((location, index) => {
          const locationData = filteredData.filter(
            (m: WaterLevelMeasurement) => m.location_name === location,
          );

          const colors = [
            {
              border: 'rgb(53, 162, 235)',
              background: 'rgba(53, 162, 235, 0.5)',
            },
            {
              border: 'rgb(255, 99, 132)',
              background: 'rgba(255, 99, 132, 0.5)',
            },
            {
              border: 'rgb(75, 192, 192)',
              background: 'rgba(75, 192, 192, 0.5)',
            },
            {
              border: 'rgb(255, 206, 86)',
              background: 'rgba(255, 206, 86, 0.5)',
            },
            {
              border: 'rgb(153, 102, 255)',
              background: 'rgba(153, 102, 255, 0.5)',
            },
          ];

          const colorIndex = index % colors.length;

          return {
            label: location,
            data: locationData.map(
              (m: WaterLevelMeasurement) => m.water_level_cm || 0,
            ),
            borderColor: colors[colorIndex].border,
            backgroundColor: colors[colorIndex].background,
          };
        });

        const labels = [
          ...new Set(
            filteredData.map((m: WaterLevelMeasurement) => {
              const date = new Date(m.timestamp);
              return `${date.getMonth() + 1}/${date.getDate()}`;
            }),
          ),
        ].map(item => String(item));

        setChartData({
          labels,
          datasets,
        });
      }
    } catch (error) {
      console.error('Error in fetchMeasurements:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMeasurements();
  }, []);

  // Filter measurements based on search term
  const filteredMeasurements = measurements.filter(measurement => {
    const searchLower = searchTerm.toLowerCase();
    return (
      (measurement.location_name &&
        measurement.location_name.toLowerCase().includes(searchLower)) ||
      (measurement.notes &&
        measurement.notes.toLowerCase().includes(searchLower))
    );
  });

  // Pagination
  const totalPages = Math.ceil(filteredMeasurements.length / rowsPerPage);
  const start = (page - 1) * rowsPerPage;
  const end = start + rowsPerPage;
  const paginatedMeasurements = filteredMeasurements.slice(start, end);

  const calculateAverageWaterLevel = () => {
    const validMeasurements = measurements.filter(
      m => m.water_level_cm !== null,
    );
    if (validMeasurements.length === 0) return 'N/A';

    const sum = validMeasurements.reduce(
      (acc, curr) => acc + (curr.water_level_cm || 0),
      0,
    );
    return (sum / validMeasurements.length).toFixed(2) + ' cm';
  };

  const getLocationCount = () => {
    const locations = new Set(
      measurements.filter(m => m.location_name).map(m => m.location_name),
    );
    return locations.size;
  };

  return (
    <DashboardLayout>
      <h1 className="text-2xl font-bold mb-6 text-gray-900">
        Water Level Measurements
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="bg-white shadow-sm border border-gray-100">
          <CardBody className="text-center">
            <div className="text-sm font-semibold text-gray-600">
              Total Measurements
            </div>
            <div className="text-3xl font-bold mt-2 text-gray-900">
              {measurements.length}
            </div>
          </CardBody>
        </Card>
        <Card className="bg-white shadow-sm border border-gray-100">
          <CardBody className="text-center">
            <div className="text-sm font-semibold text-gray-600">
              Average Water Level
            </div>
            <div className="text-3xl font-bold mt-2 text-gray-900">
              {calculateAverageWaterLevel()}
            </div>
          </CardBody>
        </Card>
        <Card className="bg-white shadow-sm border border-gray-100">
          <CardBody className="text-center">
            <div className="text-sm font-semibold text-gray-600">
              Measurement Locations
            </div>
            <div className="text-3xl font-bold mt-2 text-gray-900">
              {getLocationCount()}
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="mb-6">
        <LineChartComponent
          title="Water Level Trends by Location"
          data={chartData}
          height={350}
        />
      </div>

      <div className="mb-6">
        <Input
          label="Search measurements"
          placeholder="Search by location or notes"
          value={searchTerm}
          onValueChange={setSearchTerm}
          className="max-w-md"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <Spinner size="lg" color="primary" className="text-blue-500" />
        </div>
      ) : (
        <>
          <Table aria-label="Water level measurements table">
            <TableHeader>
              <TableColumn>LOCATION</TableColumn>
              <TableColumn>WATER LEVEL</TableColumn>
              <TableColumn>DATE/TIME</TableColumn>
              <TableColumn>DEVICES</TableColumn>
              <TableColumn>NOTES</TableColumn>
              <TableColumn>TYPE</TableColumn>
            </TableHeader>
            <TableBody>
              {paginatedMeasurements.map(measurement => (
                <TableRow key={measurement.id}>
                  <TableCell>
                    {measurement.location_name || 'Unknown'}
                  </TableCell>
                  <TableCell>
                    {measurement.water_level_cm !== null
                      ? `${measurement.water_level_cm} cm`
                      : 'Not recorded'}
                  </TableCell>
                  <TableCell>
                    {format(new Date(measurement.timestamp), 'PPp')}
                  </TableCell>
                  <TableCell>
                    {measurement.rssi_ble ? measurement.rssi_ble.length : 0}{' '}
                    BLE,{' '}
                    {measurement.rssi_wifi ? measurement.rssi_wifi.length : 0}{' '}
                    WiFi
                  </TableCell>
                  <TableCell>{measurement.notes || '-'}</TableCell>
                  <TableCell>
                    {measurement.measurement_type || 'standard'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="flex justify-between items-center mt-4">
            <span className="text-default-400 text-sm">
              Showing {start + 1} to{' '}
              {Math.min(end, filteredMeasurements.length)} of{' '}
              {filteredMeasurements.length} measurements
            </span>
            <Pagination total={totalPages} page={page} onChange={setPage} />
          </div>
        </>
      )}
    </DashboardLayout>
  );
}
