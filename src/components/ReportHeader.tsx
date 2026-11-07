import { useEffect } from 'react';
import { Box, Typography } from '@mui/material';
import { useSettingsStore } from '../store/useSettingsStore';

interface ReportHeaderProps {
  title: string;
  period: string;
}

export default function ReportHeader({ title, period }: ReportHeaderProps) {
  const { companyName, fetchSettings } = useSettingsStore();

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return (
    <Box sx={{ mb: 4, textAlign: 'center' }}>
      <Typography component="h5" variant="h5" fontWeight="800" sx={{ mb: 0.5, color: '#333' }}>
        {companyName.toUpperCase()}
      </Typography>
      <Typography component="h6" variant="h6" fontWeight="600" sx={{ mb: 0.5, color: '#555' }}>
        {title.toUpperCase()}
      </Typography>
      <Typography component="h6" variant="subtitle1" sx={{ fontStyle: 'italic', color: '#777' }}>
        {period}
      </Typography>
    </Box>
  );
}
