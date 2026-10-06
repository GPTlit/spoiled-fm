package fm.spoiled.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(MediaStoreAudioPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
