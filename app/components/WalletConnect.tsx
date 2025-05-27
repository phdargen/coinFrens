'use client';

import { useState } from 'react';
import { useConnect, Connector } from 'wagmi';
import { Button } from '@/components/ui/button';

export default function WalletConnect() {
  const [isOpen, setIsOpen] = useState(false);
  const { connect, connectors, isPending, error } = useConnect();
  
  const toggleModal = () => setIsOpen(!isOpen);
  
  const handleConnectWallet = (connector: Connector) => {
    connect({ connector });
    setIsOpen(false);
  };

  return (
    <div>
      <Button 
        variant="default" 
        size="sm" 
        onClick={toggleModal}
      >
        Sign in
      </Button>
      
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 w-80 max-w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-white">Sign in</h3>
              <button 
                onClick={toggleModal}
                className="text-gray-400 hover:text-white"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            
            {error && (
              <div className="mb-4 p-3 bg-red-900/30 border border-red-700 rounded-lg text-red-400 text-sm">
                {error.message || 'Failed to connect wallet'}
              </div>
            )}
            
            <div className="space-y-3">
              {connectors.map((connector) => (
                <button
                  key={connector.uid}
                  onClick={() => handleConnectWallet(connector)}
                  disabled={isPending}
                  className="w-full flex items-center justify-between p-3 bg-gray-800 hover:bg-gray-700 rounded-lg border border-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="font-medium text-white">
                    {connector.name}
                  </span>
                  {isPending && (
                    <span className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></span>
                  )}
                </button>
              ))}
            </div>
            
            {/* <p className="mt-4 text-xs text-gray-400 text-center">
              By connecting, you agree to the terms of service
            </p> */}
          </div>
        </div>
      )}
    </div>
  );
} 