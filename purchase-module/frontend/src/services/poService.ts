import axios from "axios";
import configuration from "../configuration"
export const poService = {
  // ... other methods ...

  getNextPONumber: async (vendorName: string) => {
    try {
      const response = await axios.get(`${configuration.api_url}/po/next-number/`, {
        params: { vendor_name: vendorName }
      });
      return response.data.po_number;
    } catch (error) {
      console.error('Error getting next PO number:', error);
      throw error;
    }
  }
}; 